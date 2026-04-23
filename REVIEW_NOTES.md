# Project Review Notes (Deferred Fixes)

This file tracks issues found during a static code review so they can be addressed later.

## Priority Issues

### 1) Critical: Unauthenticated SQL execution API
- **File:** `app/api/db/query/route.ts`
- **Issue:** The endpoint accepts raw `type/config/sql` and executes the query without authentication or organization membership verification.
- **Risk:** Unauthorized query execution against databases reachable by server-side infrastructure.
- **Suggested fix later:**
  - Require authenticated user via Clerk.
  - Verify organization membership before query execution.
  - Restrict SQL to safe read-only patterns and add row/time limits.

### 2) Critical: Unauthenticated DB connection test API
- **File:** `app/api/test-connection/route.ts`
- **Issue:** No auth check before attempting outbound DB connection using request-provided host/credentials.
- **Risk:** Abuse as a connection probe from server environment.
- **Suggested fix later:**
  - Require authentication and org membership.
  - Validate/allowlist target hosts where applicable.
  - Add request rate limiting and strict timeout controls.

### 3) High: Membership privilege escalation
- **File:** `convex/memberships.ts`
- **Issue:** `syncMembership` allows authenticated users to join org by ID and defaults role to `admin`.
- **Risk:** Unauthorized org access and privilege escalation.
- **Suggested fix later:**
  - Verify Clerk org membership/role before creating membership.
  - Default role to `member` at most.
  - Remove automatic owner assignment side effect.

### 4) High: Missing authorization checks in database config operations
- **File:** `convex/databaseConfigs.ts`
- **Issue:** Core queries/mutations do not enforce membership checks.
- **Risk:** Potential cross-organization config reads/writes if callable by untrusted contexts.
- **Suggested fix later:**
  - Add `checkMembership` consistently for list/get/create/update/remove operations.
  - Add tests for cross-org denial cases.

### 5) Medium: Stale auth module vs schema mismatch
- **Files:** `convex/auth.ts`, `convex/schema.ts`
- **Issue:** `auth.ts` references fields/tables not present in current schema (for example, `sessions`, `passwordHash`, `emailVerified`).
- **Risk:** Runtime failures if used, confusion and maintenance overhead.
- **Suggested fix later:**
  - Remove unused legacy auth module or align schema + implementation.
  - Document canonical auth path (Clerk + Convex).

### 6) Medium: Weak SQL safety guard in chat agent
- **File:** `lib/chat-agent.ts`
- **Issue:** SQL safety check only validates leading keyword.
- **Risk:** Expensive/abusive read queries still possible.
- **Suggested fix later:**
  - Add stronger SQL policy checks.
  - Enforce query timeout, statement limits, and max returned rows at executor level.

## Test Coverage Gaps

- No clear automated unit/integration test suite is wired in `package.json`.
- Add tests for:
  - API auth/authz on all DB and settings routes.
  - Membership boundary enforcement.
  - SQL guard behavior and execution limits.
  - Cross-org access denial regression scenarios.

## Suggested Fix Order

1. Lock down public API routes (`db/query`, `test-connection`).
2. Fix membership escalation in `syncMembership`.
3. Enforce authz in `databaseConfigs` module.
4. Harden SQL execution policies and limits.
5. Clean up or remove stale `convex/auth.ts`.
6. Add regression tests for all above.

---

Status: deferred intentionally for later implementation.
