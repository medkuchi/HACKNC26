// Onboarding Step 4 — Connect iMessage. Route: "/onboarding/connect-imessage"
// - Displays Nova's Photon-provided iMessage identity (phone number /
//   handle) for the user to message.
// - Generates a short-lived pairing code (via POST /api/pairing) and
//   instructs the user to text it to Nova.
// - Polls for / listens for verification once the apps/photon-agent
//   worker receives the code back via an incoming iMessage, then links
//   the verified messaging identity to the authenticated Supabase user.
// - Shows connection success/failure state; allows "Skip for now".

import PlaceholderPage from "@/components/PlaceholderPage";

export default function Page() {
  return (
    <PlaceholderPage
      title="Connect iMessage"
    />
  );
}
