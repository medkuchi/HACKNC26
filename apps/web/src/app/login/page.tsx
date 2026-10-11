// Authentication page (Page 2 of spec) — route: "/login"
// - Supabase Auth: Google Sign-In button + optional email/password form.
// - Handles loading state while redirecting to Supabase OAuth, and
//   displays auth errors (invalid credentials, OAuth failure, etc).
// - Redirects already-authenticated users straight to /dashboard.

import PlaceholderPage from "@/components/PlaceholderPage";

export default function Page() {
  return (
    <PlaceholderPage
      title="Sign in"
      description="Supabase authentication is deferred. You can open the demo from the homepage."
    />
  );
}
