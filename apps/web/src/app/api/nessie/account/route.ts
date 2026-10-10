import { CashAccountRequiredError, createFinancialDataSource, createNessieAccount } from "../../../../lib/nessie/adapters";
import { parseAccountCreationInput } from "../../../../lib/nessie/client";
import type { AccountCreationInput } from "../../../../lib/nessie/client";
import { jsonResponse, readNessieOptions } from "../../../../lib/nessie/config";

// Deferred until the Supabase client and schema are implemented.
// import { createServerClient } from "../../../../lib/supabase/server";
export const runtime = "nodejs";

/** POST body: { customerId, type: "Checking" | "Savings", nickname, balance }. */
export async function POST(request: Request): Promise<Response> {
  // FUTURE AUTH:
  // const supabase = await createServerClient();
  // const { data: { user } } = await supabase.auth.getUser();
  // if (!user) return jsonResponse({ error: "Authentication required" }, 401);
  // Load customerId from this user's saved account link instead of the request.

  let customerId: string;
  let input: AccountCreationInput;
  try {
    const body: unknown = await request.json();
    input = parseAccountCreationInput(body);
    const value = (body as Record<string, unknown>).customerId;
    if (typeof value !== "string" || !value.trim()) throw new TypeError("customerId is required");
    customerId = value.trim();
  } catch (error) {
    return jsonResponse({ error: error instanceof TypeError ? error.message : "Request body must be valid JSON" }, 400);
  }
  let options;
  try { options = readNessieOptions(); }
  catch (error) { return jsonResponse({ error: (error as Error).message }, 503); }
  try {
    const { account, dataSource } = await createNessieAccount(customerId, input, options);
    // FUTURE PERSISTENCE: confirm column names when implementing the migration.
    // const { error } = await supabase.from("nessie_accounts").upsert(
    //   { user_id: user.id, customer_id: customerId, account_id: account._id },
    //   { onConflict: "user_id" },
    // );
    // if (error) return jsonResponse({ error: "Account created, but link could not be saved",
    //   accountId: account._id }, 500);
    return jsonResponse({ accountId: account._id, account, dataSource }, 201);
  } catch {
    return jsonResponse({ error: "Unable to create the Nessie account" }, 502);
  }
}

/** GET /api/nessie/account?accountId=... — cash balance and account details. */
export async function GET(request: Request): Promise<Response> {
  // FUTURE AUTH: authenticate and load accountId from the user's saved link.
  // Do not trust a caller-supplied accountId once authentication is enabled.
  const accountId = new URL(request.url).searchParams.get("accountId")?.trim();
  if (!accountId) return jsonResponse({ error: "accountId query parameter is required" }, 400);
  let options;
  try { options = readNessieOptions(); }
  catch (error) { return jsonResponse({ error: (error as Error).message }, 503); }
  try {
    const source = createFinancialDataSource(options);
    const account = await source.getAccount(accountId);
    return jsonResponse({ accountId: account._id, account, balance: account.balance,
      currency: options.currency ?? "USD", dataSource: source.dataSource });
  } catch (error) {
    if (error instanceof CashAccountRequiredError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: "Unable to load the Nessie account" }, 502);
  }
}
