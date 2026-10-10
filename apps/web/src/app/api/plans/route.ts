// GET /api/plans — list all spending plans for the authenticated user.
// POST /api/plans — create a plan (manual entry, or programmatically
//   from a Gemini-detected intent forwarded by apps/photon-agent).
// Plan fields: name, estimated cost, category, expected date, status
// (tentative/confirmed/canceled/completed), source (private iMessage /
// authorized group / manual), computed risk score + projected impact.
