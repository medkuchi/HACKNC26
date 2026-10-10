// POST /api/pairing — generates a short-lived (e.g. 10 min) numeric
//   pairing code for the authenticated user, stored in Supabase keyed
//   by user id, for onboarding Step 4 (Connect iMessage).
// PATCH/POST (internal, called by photon-agent) — verifies a pairing
//   code received over iMessage and, on match, links the sender's
//   Photon messaging identity to the Supabase user account.
