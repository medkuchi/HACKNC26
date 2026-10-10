// POST /api/photon/webhook
// Receives forwarded, already-identified iMessage events from the
// apps/photon-agent persistent worker (sender, conversation id,
// private-vs-group flag, message text). Authenticates the request via
// PHOTON_AGENT_SHARED_SECRET. Orchestrates: Gemini intent detection ->
// forecast engine risk check -> plan creation -> Nova reply text ->
// hands the reply back to photon-agent to send over iMessage. This is
// the single backend entry point described in spec section 8's message
// flow (no separate post-Gemini component).
