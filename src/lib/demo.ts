/**
 * Fixed IDs for the seeded demo property and admin user, shared between
 * `db/seed.ts` and the app. Stand-ins until real auth (BUILD-PROMPT step 5)
 * establishes a session-derived principal — see src/lib/db/scope.ts.
 */
export const DEMO_PROPERTY_ID = '00000000-0000-7000-8000-0000000000a1';
export const DEMO_ADMIN_USER_ID = '00000000-0000-7000-8000-0000000000a2';
