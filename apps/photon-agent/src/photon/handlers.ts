// Incoming iMessage event handling.
// - Identifies sender + conversation, and whether the conversation is
//   private or group-based.
// - Ignores the worker's own outbound events to prevent response loops.
// - Handles different message content types (text at minimum).
// - For opted-in conversations: forwards the message to the Bridge
//   backend (POST /api/photon/webhook via services/bridgeApiClient.ts)
//   and sends back whatever reply text the backend returns.
// - For a pairing-code message: routes to services/pairing.ts instead.
