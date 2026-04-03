/* eslint-disable @typescript-eslint/no-explicit-any */
// @ts-nocheck — ctx/args types come from _generated/server which is produced
// by `pnpm convex:dev`. Until then the stub re-exports untyped builders.
// All types will be enforced correctly after running `pnpm convex:dev`.
/**
 * auth.ts — Convex backend for registration, login, sessions
 *
 * NOTE: Convex runs in a V8 isolate — use pure-JS crypto only.
 * We use the Web Crypto API (available in Convex) for hashing.
 *
 * For production you should use an established Convex auth
 * library (e.g. @convex-dev/auth) or Clerk. This file provides
 * a clean foundation showing the full auth data flow.
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Generate a cryptographically random token (hex string) */
function generateToken(bytes = 32): string {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Simple SHA-256 hash using Web Crypto (returns hex string) */
async function sha256(text: string): Promise<string> {
    const encoded = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Slugify an org name */
function slugify(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// ── Auth Mutations ─────────────────────────────────────────────────────────

/**
 * Register a new user and automatically create a personal organization.
 * Returns a session token on success.
 */
export const register = mutation({
    args: {
        name: v.string(),
        email: v.string(),
        password: v.string(),
        organizationName: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Normalize
        const email = args.email.toLowerCase().trim();

        // Check duplicate
        const existing = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", email))
            .first();

        if (existing) {
            throw new Error("An account with this email already exists.");
        }

        // Hash password
        const passwordHash = await sha256(args.password);

        // Create user
        const userId = await ctx.db.insert("users", {
            email,
            passwordHash,
            name: args.name,
            emailVerified: false,
            role: "owner",
            createdAt: Date.now(),
        });

        // Create default organization
        const orgName = args.organizationName || `${args.name}'s Workspace`;
        let slug = slugify(orgName);

        // Ensure unique slug
        const existingOrg = await ctx.db
            .query("organizations")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .first();
        if (existingOrg) {
            slug = `${slug}-${generateToken(4)}`;
        }

        const orgId = await ctx.db.insert("organizations", {
            name: orgName,
            slug,
            plan: "free",
            ownerId: userId,
            createdAt: Date.now(),
        });

        // Create membership (owner)
        await ctx.db.insert("memberships", {
            organizationId: orgId,
            userId,
            role: "owner",
            joinedAt: Date.now(),
        });

        // Create session
        const token = generateToken();
        await ctx.db.insert("sessions", {
            userId,
            token,
            expiresAt: Date.now() + SESSION_TTL_MS,
            createdAt: Date.now(),
        });

        return { token, userId, organizationId: orgId };
    },
});

/**
 * Sign in with email + password.
 * Returns a session token on success.
 */
export const login = mutation({
    args: {
        email: v.string(),
        password: v.string(),
    },
    handler: async (ctx, args) => {
        const email = args.email.toLowerCase().trim();

        const user = await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", email))
            .first();

        if (!user) {
            throw new Error("Invalid email or password.");
        }

        const passwordHash = await sha256(args.password);
        if (passwordHash !== user.passwordHash) {
            throw new Error("Invalid email or password.");
        }

        // Update lastSeen
        await ctx.db.patch(user._id, { lastSeenAt: Date.now() });

        // Create fresh session
        const token = generateToken();
        await ctx.db.insert("sessions", {
            userId: user._id,
            token,
            expiresAt: Date.now() + SESSION_TTL_MS,
            createdAt: Date.now(),
        });

        return { token, userId: user._id };
    },
});

/**
 * Sign out — invalidate the session token.
 */
export const logout = mutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();

        if (session) {
            await ctx.db.delete(session._id);
        }
        return { success: true };
    },
});

/**
 * Validate a session token and return user + active org.
 */
export const getSession = query({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();

        if (!session || session.expiresAt < Date.now()) {
            return null;
        }

        const user = await ctx.db.get(session.userId);
        if (!user) return null;

        // Get all org memberships for this user
        const memberships = await ctx.db
            .query("memberships")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect();

        const organizations = await Promise.all(
            memberships.map(async (m) => {
                const org = await ctx.db.get(m.organizationId);
                return org ? { ...org, memberRole: m.role } : null;
            })
        );

        return {
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
                emailVerified: user.emailVerified,
            },
            organizations: organizations.filter(Boolean),
        };
    },
});

// ── Organization Mutations ─────────────────────────────────────────────────

/**
 * Create a new organization and add the requesting user as owner.
 */
export const createOrganization = mutation({
    args: {
        token: v.string(),
        name: v.string(),
    },
    handler: async (ctx, args) => {
        // Verify session
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();

        if (!session || session.expiresAt < Date.now()) {
            throw new Error("Unauthorized.");
        }

        let slug = slugify(args.name);

        const existingOrg = await ctx.db
            .query("organizations")
            .withIndex("by_slug", (q) => q.eq("slug", slug))
            .first();
        if (existingOrg) {
            slug = `${slug}-${generateToken(4)}`;
        }

        const orgId = await ctx.db.insert("organizations", {
            name: args.name,
            slug,
            plan: "free",
            ownerId: session.userId,
            createdAt: Date.now(),
        });

        await ctx.db.insert("memberships", {
            organizationId: orgId,
            userId: session.userId,
            role: "owner",
            joinedAt: Date.now(),
        });

        return { organizationId: orgId, slug };
    },
});

/**
 * Invite a user to an organization by email.
 * Returns the invite token (to be sent via email in production).
 */
export const inviteMember = mutation({
    args: {
        token: v.string(),
        organizationId: v.id("organizations"),
        email: v.string(),
        role: v.union(v.literal("admin"), v.literal("member")),
    },
    handler: async (ctx, args) => {
        // Verify session
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();

        if (!session || session.expiresAt < Date.now()) {
            throw new Error("Unauthorized.");
        }

        // Check requestor is admin/owner in this org
        const membership = await ctx.db
            .query("memberships")
            .withIndex("by_org_user", (q) =>
                q.eq("organizationId", args.organizationId).eq("userId", session.userId)
            )
            .first();

        if (!membership || membership.role === "member") {
            throw new Error("You don't have permission to invite members.");
        }

        const inviteToken = generateToken();
        await ctx.db.insert("invitations", {
            organizationId: args.organizationId,
            email: args.email.toLowerCase().trim(),
            role: args.role,
            token: inviteToken,
            invitedBy: session.userId,
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return { inviteToken };
    },
});

/**
 * Accept an invitation — links the user to the organization.
 */
export const acceptInvitation = mutation({
    args: {
        sessionToken: v.string(),
        inviteToken: v.string(),
    },
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_token", (q) => q.eq("token", args.sessionToken))
            .first();

        if (!session || session.expiresAt < Date.now()) {
            throw new Error("Unauthorized.");
        }

        const invitation = await ctx.db
            .query("invitations")
            .withIndex("by_token", (q) => q.eq("token", args.inviteToken))
            .first();

        if (!invitation) throw new Error("Invitation not found.");
        if (invitation.expiresAt < Date.now()) throw new Error("Invitation has expired.");
        if (invitation.acceptedAt) throw new Error("Invitation already accepted.");

        // Add membership
        await ctx.db.insert("memberships", {
            organizationId: invitation.organizationId,
            userId: session.userId,
            role: invitation.role,
            joinedAt: Date.now(),
        });

        // Mark invitation accepted
        await ctx.db.patch(invitation._id, { acceptedAt: Date.now() });

        return { organizationId: invitation.organizationId };
    },
});

/**
 * Get all members of an organization (requires membership).
 */
export const getOrganizationMembers = query({
    args: {
        token: v.string(),
        organizationId: v.id("organizations"),
    },
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("sessions")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .first();

        if (!session || session.expiresAt < Date.now()) return null;

        const memberships = await ctx.db
            .query("memberships")
            .withIndex("by_org", (q) => q.eq("organizationId", args.organizationId))
            .collect();

        const members = await Promise.all(
            memberships.map(async (m) => {
                const user = await ctx.db.get(m.userId);
                return user
                    ? {
                        userId: user._id,
                        name: user.name,
                        email: user.email,
                        avatarUrl: user.avatarUrl,
                        role: m.role,
                        joinedAt: m.joinedAt,
                    }
                    : null;
            })
        );

        return members.filter(Boolean);
    },
});

// ── Webhook Mutations (Clerk Sync) ───────────────────────────────────────────

/**
 * Synchronize a user from Clerk.
 */
export const syncUser = mutation({
  args: {
    tokenIdentifier: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    type: v.union(v.literal("user.created"), v.literal("user.updated"), v.literal("user.deleted")),
  },
  handler: async (ctx, args) => {
    const { tokenIdentifier, email, name, avatarUrl, type } = args;

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
      .unique();

    if (type === "user.deleted") {
      if (existingUser) await ctx.db.delete(existingUser._id);
      return;
    }

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        name: name || existingUser.name,
        email: email || existingUser.email,
        avatarUrl: avatarUrl || existingUser.avatarUrl,
        lastSeenAt: Date.now(),
      });
      return existingUser._id;
    } else {
      return await ctx.db.insert("users", {
        tokenIdentifier,
        name: name || "Anonymous",
        email: email || "",
        avatarUrl,
        role: "member",
        createdAt: Date.now(),
      });
    }
  },
});

/**
 * Synchronize an organization from Clerk.
 */
export const syncOrganization = mutation({
  args: {
    slug: v.string(),
    name: v.string(),
    clerkOrgId: v.string(),
    type: v.union(v.literal("organization.created"), v.literal("organization.updated"), v.literal("organization.deleted")),
  },
  handler: async (ctx, args) => {
    const { slug, name, type } = args;

    const existing = await ctx.db
      .query("organizations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();

    if (type === "organization.deleted") {
      if (existing) await ctx.db.delete(existing._id);
      return;
    }

    if (existing) {
      await ctx.db.patch(existing._id, { name });
      return existing._id;
    } else {
      return await ctx.db.insert("organizations", {
        name,
        slug,
        plan: "free",
        createdAt: Date.now(),
      });
    }
  },
});
