// Google Gemini API client wrapper (server-only — keeps
// GOOGLE_GEMINI_API_KEY out of the browser bundle).
// - Thin wrapper around @google/generative-ai for text generation calls.
// - Falls back to a mock adapter (canned/templated responses) when
//   USE_MOCK_GEMINI is set or the key is missing, so AI-dependent flows
//   stay testable without credentials.
