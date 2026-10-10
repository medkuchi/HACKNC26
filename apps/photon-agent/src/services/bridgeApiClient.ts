// HTTP client for calling back into the Next.js app's internal API
// routes (POST /api/photon/webhook, pairing verification, etc).
// - Authenticates outgoing requests with PHOTON_AGENT_SHARED_SECRET.
// - Keeps the photon-agent process free of direct Supabase/Gemini/
//   Nessie access — all of that stays behind the web app's API routes
//   per the single-backend-entry-point architecture in spec section 8.
