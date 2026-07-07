import { auth as clerkAuth } from "@clerk/nextjs/server";

/**
 * A testable wrapper around Clerk's server-side auth() function.
 * By using this helper instead of importing @clerk/nextjs/server directly,
 * we can stub out authentication in unit/integration tests without complex ESM loaders.
 */
export const auth = {
  getAuth: async () => {
    return clerkAuth();
  }
};
