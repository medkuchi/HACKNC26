// Supabase OAuth callback route handler — route: "/auth/callback"
// - Exchanges the OAuth "code" query param for a Supabase session via
//   the server-side Supabase client (lib/supabase/server.ts).
// - On success, redirects to /onboarding (new users) or /dashboard
//   (returning users with completed onboarding).
// - On failure, redirects back to /login with an error message.

// Activate the Supabase callback when authentication is implemented.
export function GET() {
  return Response.json(
    { error: "Supabase authentication is deferred for this demo." },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}
