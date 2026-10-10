// Entry point for the persistent Node.js Photon messaging worker
// (spec section 8). Responsibilities on boot:
// - Initialize the Photon Spectrum SDK client (photon/client.ts).
// - Register the incoming-message handler (photon/handlers.ts).
// - Start a long-running process (not a serverless function) so the
//   iMessage connection stays alive.
// - Graceful shutdown + reconnect-on-drop handling.
