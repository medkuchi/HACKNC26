// Server-side Supabase client factory (for Server Components, Route
// Handlers, and Server Actions).
// - Initializes @supabase/ssr createServerClient wired to Next.js
//   cookies() for session persistence.
// - A separate service-role client (using SUPABASE_SERVICE_ROLE_KEY)
//   is exposed here too, for privileged operations like the
//   /api/photon/webhook handler writing on behalf of a user without
//   their session cookie.
