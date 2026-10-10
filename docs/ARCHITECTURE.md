<!--
TODO: Architecture overview doc. Should cover:
- Monorepo layout (apps/web, apps/photon-agent, packages/shared).
- End-to-end message flow (spec section 8): user iMessage -> Photon ->
  photon-agent -> /api/photon/webhook -> Gemini intent detection ->
  deterministic forecast engine -> Nova reply -> back through Photon.
- Where real integrations vs. mock adapters are used (Nessie, Gemini).
- Data model summary (link to supabase/migrations).
-->
