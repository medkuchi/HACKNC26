// Maintains the mapping between Photon messaging identities (phone
// number / handle) and linked Supabase user accounts.
// - Used by handlers.ts to know which user a given incoming iMessage
//   belongs to, and whether that sender/conversation is authorized for
//   monitoring.
