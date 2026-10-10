// Capital One Nessie API client (server-only — keeps NESSIE_API_KEY
// out of the browser bundle). Exposes the functions listed in spec
// section 7:
//   createNessieCustomer(), createNessieAccount(), getAccountBalance(),
//   getAccountPurchases(), getUpcomingBills(), getMerchants(),
//   getFinancialOverview().
// - Validates Nessie response shapes defensively (documented schema,
//   not assumed).
// - Applies basic caching to avoid redundant calls per spec section 7.
// - Delegates to lib/nessie/adapters.ts to pick real vs. mock
//   implementation based on USE_MOCK_NESSIE / key presence.
