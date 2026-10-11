// Settings page — route: "/dashboard/settings"
// - Account: email, connected Google identity, sign-out.
// - Financial preferences: safety buffer amount, alert thresholds
//   (editable versions of onboarding Step 3 choices).
// - Linked Nessie account info (read-only, simulated-data disclaimer).
// - Privacy controls: revoke iMessage monitoring, delete processed
//   message metadata, data-export/delete-account entry points.

import PlaceholderPage from "@/components/PlaceholderPage";

export default function Page() {
  return (
    <PlaceholderPage
      title="Settings"
    />
  );
}
