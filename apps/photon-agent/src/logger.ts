// Lightweight structured logger for the messaging worker.
// - Logs connection lifecycle, message routing decisions, and errors.
// - Per spec section 8: logs metadata (sender id, conversation id,
//   event type) without persisting unnecessary raw message content.
