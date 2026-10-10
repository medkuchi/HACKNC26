// My Plans page (Page 5 of spec) — route: "/dashboard/plans"
// - Lists all detected + manually entered spending plans.
// - "Add plan" form for manual entry (name, est. cost, category, date).
// - Edit / delete / dismiss actions per plan.
// - Status toggle: Tentative / Confirmed / Canceled / Completed.
// - Per-plan display: estimated cost, category, expected date, source
//   (Private iMessage / Authorized Group / Manual entry), projected
//   financial impact, calculated risk score.
// - Per-plan actions: "Explore Alternatives" (what-if cost adjustment)
//   and "View Forecast" (jumps to /dashboard/forecast scoped to this plan).
// Example seed plan per spec: "Weekend Trip to Charlotte", $150, Travel,
// Tentative, Saturday, $85 projected shortfall, High risk.
