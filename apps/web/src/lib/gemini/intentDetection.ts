// Spending-intent detection logic built on lib/gemini/client.ts +
// prompts.ts. Takes raw message text (+ conversation context) and
// returns a structured, validated intent object. Performs NO financial
// math itself — purely NLP extraction, per spec section 6 ("financial
// arithmetic must be performed by deterministic backend code, not
// Gemini").
