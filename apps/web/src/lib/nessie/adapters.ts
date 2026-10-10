// Adapter layer selecting between the real Nessie HTTP client and a
// mock in-memory implementation (seeded fictional demo accounts).
// - Mock adapter returns clearly-labeled simulated data matching the
//   same TypeScript interfaces as the real client — never presented as
//   real bank data (per spec section 7 + product philosophy).
// - Selection driven by USE_MOCK_NESSIE env flag / missing API key.
