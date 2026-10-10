// Transactions page — route: "/dashboard/transactions"
// - Lists real(simulated) Nessie transaction/purchase history for the
//   linked account: merchant, amount, date, category.
// - Read-only view fed by GET /api/nessie/overview (or a dedicated
//   transactions endpoint) — never mixed with tentative "plans" data
//   so confirmed vs. planned spend stays clearly separated.
