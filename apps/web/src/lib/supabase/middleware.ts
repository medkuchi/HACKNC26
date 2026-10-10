// Supabase session-refresh helper used by the root Next.js middleware.ts.
// - Refreshes the Supabase auth cookie on each request.
// - Determines auth state for route protection decisions (redirect to
//   /login or /onboarding as appropriate).
