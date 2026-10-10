// Deterministic financial forecast engine (spec section 6). Pure
// TypeScript — no AI calls here, so results are reproducible/testable.
// - Implements B(t) = B(0) + cumulative income - cumulative expenses -
//   planned purchases occurring by time t, applying each event on its
//   expected date.
// - Produces: projected daily balance series, minimum projected
//   balance, first date balance goes negative, maximum projected
//   shortfall, remaining amount after upcoming obligations.
// - Produces both a baseline forecast and an alternative forecast that
//   includes a candidate planned purchase, plus the dollar difference
//   between them and that difference relative to the safety buffer.
// - Handles the documented edge cases: income after a due bill,
//   multiple same-day bills, already-overdrawn accounts, tentative-only
//   purchases, uncertain amounts, canceled plans, changed bill
//   amounts/dates, new income events, sparse historical data.
