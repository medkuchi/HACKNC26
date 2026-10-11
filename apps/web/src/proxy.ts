// Next.js request proxy — runs on every matched request.
// - Refreshes the Supabase session cookie via lib/supabase/middleware.ts.
// - Redirects unauthenticated users away from /dashboard/* and
//   /onboarding/* to /login.
// - Redirects authenticated-but-not-onboarded users from /dashboard/*
//   to /onboarding.

import { NextResponse } from "next/server";

// Supabase authentication is deferred for the single-user demo.
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*"],
};
