// TODO: Temporary hotfix for Node.js IPv6 DNS resolution issues with Clerk/Convex
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { getServerConvexUrl } from "@/lib/server-convex-url";

function getConvexClient() {
  const url = getServerConvexUrl();
  if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  return new ConvexHttpClient(url);
}

/** Retry a Convex mutation with exponential backoff (handles transient ECONNREFUSED on startup). */
async function retryMutation<T>(
  convex: ConvexHttpClient,
  mutation: any,
  args: any,
  maxRetries = 3,
  baseDelayMs = 1000,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await convex.mutation(mutation, args);
    } catch (err: any) {
      const isTransient = err?.cause?.code === 'ECONNREFUSED' || err?.message?.includes('fetch failed');
      if (isTransient && attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.warn(`[Webhook] Convex unreachable (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
  throw new Error('retryMutation: unreachable');
}

export async function POST(req: Request) {
  const convex = getConvexClient();
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('⨯ Error: CLERK_WEBHOOK_SECRET is not set. Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local to enable Clerk webhook sync.');
    return new Response('Error: CLERK_WEBHOOK_SECRET is missing', { status: 400 });
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400
    });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400
    });
  }

  const { id } = evt.data;
  const eventType = evt.type;

  console.log(`Webhook with and ID of ${id} and type of ${eventType}`);

  if (eventType === 'user.created' || eventType === 'user.updated') {
    const { id, email_addresses, first_name, last_name, image_url } = evt.data;
    const email = email_addresses?.[0]?.email_address;
    const name = `${first_name || ''} ${last_name || ''}`.trim();

    // Build the full Convex-compatible tokenIdentifier: "<issuerDomain>|<userId>"
    const issuerDomain = process.env.CLERK_ISSUER_DOMAIN || '';
    const tokenIdentifier = issuerDomain ? `${issuerDomain}|${id}` : id;

    console.log(`Syncing user: ${tokenIdentifier} (${email})...`);
    try {
      const result = await retryMutation(convex, api.auth.syncUser, {
        tokenIdentifier,
        email,
        name,
        avatarUrl: image_url,
        type: eventType,
      });
      console.log(`User sync result:`, result);
    } catch (e: any) {
      console.error(`FAILED to sync user to Convex:`, e.message);
    }
  }

  if (eventType === 'organization.created' || eventType === 'organization.updated') {
    const { id, name, slug } = evt.data;
    
    // Use the ID as a fallback slug if Clerk hasn't generated one yet
    const finalSlug = slug || id;
    if (finalSlug) {
        console.log(`Syncing organization: ${finalSlug} (${name})...`);
        try {
          const result = await retryMutation(convex, api.auth.syncOrganization, {
              clerkOrgId: id,
              name,
              slug: finalSlug,
              type: eventType,
          });
          console.log(`Org sync result:`, result);
        } catch (e: any) {
          console.error(`FAILED to sync organization to Convex:`, e.message);
        }
    }
  }

  if (eventType === 'organizationMembership.created' || eventType === 'organizationMembership.updated' || eventType === 'organizationMembership.deleted') {
    const { organization, public_user_data, role } = evt.data;
    const clerkOrgId = organization.id;
    const clerkUserId = public_user_data.user_id;

    // Build the full Convex-compatible tokenIdentifier
    const issuerDomain = process.env.CLERK_ISSUER_DOMAIN || '';
    const tokenIdentifier = issuerDomain ? `${issuerDomain}|${clerkUserId}` : clerkUserId;

    console.log(`Syncing membership for ${clerkUserId} in ${clerkOrgId}...`);
    try {
      const result = await retryMutation(convex, api.auth.syncMembership, {
        clerkOrgId,
        tokenIdentifier,
        role,
        type: eventType,
      });
      console.log(`Membership sync result:`, result);
    } catch (e: any) {
      console.error(`FAILED to sync membership to Convex:`, e.message);
    }
  }

  // TODO: Add more event handlers (e.g. user.deleted)

  return new Response('', { status: 200 });
}
