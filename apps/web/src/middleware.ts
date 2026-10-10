// Next.js middleware — runs on every matched request.
// - Refreshes the Supabase session cookie via lib/supabase/middleware.ts.
// - Redirects unauthenticated users away from /dashboard/* and
//   /onboarding/* to /login.
// - Redirects authenticated-but-not-onboarded users from /dashboard/*
//   to /onboarding.
