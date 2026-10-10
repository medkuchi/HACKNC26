// Handles the onboarding "Connect iMessage" pairing flow from the
// agent side: when an incoming iMessage looks like a pairing code,
// verifies it against the Bridge backend (POST /api/pairing) and, on
// success, links the sender's Photon identity to the Supabase user via
// identityMap.ts.
