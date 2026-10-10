// GET /api/nessie/overview
// Aggregates everything the dashboard needs from Nessie in one call:
// balance, purchases, upcoming bills, merchants — via
// lib/nessie/client.ts getFinancialOverview(). Applies response
// validation + caching (per spec section 7) to avoid redundant Nessie
// API calls on every dashboard load.
