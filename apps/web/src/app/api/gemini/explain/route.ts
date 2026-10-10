// POST /api/gemini/explain
// Given a forecast/risk result computed by the deterministic engine,
// asks Gemini to generate Nova's natural-language explanation (e.g.
// the "Chirp chirp! That Charlotte trip..." style message). Gemini only
// phrases the already-computed numbers — it never recalculates them.
