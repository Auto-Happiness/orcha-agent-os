/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiKeys from "../aiKeys.js";
import type * as auth from "../auth.js";
import type * as databaseConfigs from "../databaseConfigs.js";
import type * as mcpTools from "../mcpTools.js";
import type * as messages from "../messages.js";
import type * as organizations from "../organizations.js";
import type * as savedQueries from "../savedQueries.js";
import type * as seed from "../seed.js";
import type * as semanticModels from "../semanticModels.js";
import type * as semanticRelationships from "../semanticRelationships.js";
import type * as users from "../users.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiKeys: typeof aiKeys;
  auth: typeof auth;
  databaseConfigs: typeof databaseConfigs;
  mcpTools: typeof mcpTools;
  messages: typeof messages;
  organizations: typeof organizations;
  savedQueries: typeof savedQueries;
  seed: typeof seed;
  semanticModels: typeof semanticModels;
  semanticRelationships: typeof semanticRelationships;
  users: typeof users;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
