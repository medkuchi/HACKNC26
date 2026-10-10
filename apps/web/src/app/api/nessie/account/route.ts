// POST /api/nessie/account, GET /api/nessie/account
// POST: creates a simulated Nessie bank account under the user's
//   Nessie customer (createNessieAccount), then persists the returned
//   account_id.
// GET: fetches the linked account's current balance (getAccountBalance)
//   for display during onboarding / settings.
