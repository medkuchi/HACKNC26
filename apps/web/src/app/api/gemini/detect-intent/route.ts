// POST /api/gemini/detect-intent
// Internal endpoint called by apps/photon-agent when a new iMessage
// arrives in an opted-in conversation. Passes message text to
// lib/gemini/intentDetection.ts to extract: plan description,
// estimated cost, currency, expected date, category, participation,
// tentative-vs-confirmed, and confidence. Returns structured JSON only
// — does NOT perform any financial arithmetic (that stays in the
// deterministic forecast engine, per spec section 6).
