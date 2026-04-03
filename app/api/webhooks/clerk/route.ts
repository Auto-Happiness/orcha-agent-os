import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
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

    console.log(`Syncing user: ${id} (${email})...`);
    try {
      const result = await convex.mutation(api.auth.syncUser, {
        tokenIdentifier: id,
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
    
    if (slug) {
        console.log(`Syncing organization: ${slug} (${name})...`);
        try {
          const result = await convex.mutation(api.auth.syncOrganization, {
              clerkOrgId: id,
              name,
              slug,
              type: eventType,
          });
          console.log(`Org sync result:`, result);
        } catch (e: any) {
          console.error(`FAILED to sync organization to Convex:`, e.message);
        }
    }
  }

  // TODO: Add more event handlers (e.g. user.deleted, organization.membership.created)

  return new Response('', { status: 200 });
}
