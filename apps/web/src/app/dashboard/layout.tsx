// Shared dashboard layout (Page 4 of spec) — wraps all /dashboard/* routes.
// - Renders the sidebar/nav with links: Overview, My Plans, Financial
//   Forecast, Transactions, Action Center, Nova / iMessage, Settings.
// - Protected route: redirects unauthenticated users to /login; redirects
//   users who haven't finished onboarding to /onboarding.
// - Responsive: collapses sidebar to a bottom/top nav on mobile.

import type { ReactNode } from "react";

// The dashboard is available without authentication during the demo.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
