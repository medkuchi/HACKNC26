// POST /api/nessie/customer
// Creates a simulated Nessie customer for the authenticated Supabase
// user (first step of onboarding's Financial Setup). Delegates to
// lib/nessie/client.ts createNessieCustomer(). Stores the returned
// Nessie customer_id against the user's row in Supabase Postgres.
