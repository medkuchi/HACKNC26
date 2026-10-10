import { CashAccountRequiredError, createFinancialDataSource } from "../../../../lib/nessie/adapters";
import { jsonResponse, readNessieOptions } from "../../../../lib/nessie/config";

// Deferred until the Supabase client and schema are implemented.
// import { createServerClient } from "../../../../lib/supabase/server";
export const runtime = "nodejs";

/** GET /api/nessie/overview?accountId=... — current balance, purchases, and bills. */
export async function GET(request: Request): Promise<Response> {
  // FUTURE AUTH:
  // const supabase = await createServerClient();
  // const { data: { user } } = await supabase.auth.getUser();
  // if (!user) return jsonResponse({ error: "Authentication required" }, 401);
  // const { data: link, error } = await supabase.from("nessie_accounts")
  //   .select("account_id").eq("user_id", user.id).single();
  // if (error || !link) return jsonResponse({ error: "No linked account" }, 404);
  // Use link.account_id instead of the query parameter below.

  const accountId = new URL(request.url).searchParams.get("accountId")?.trim();
  if (!accountId) return jsonResponse({ error: "accountId query parameter is required" }, 400);
  let options;
  try { options = readNessieOptions(); }
  catch (error) { return jsonResponse({ error: (error as Error).message }, 503); }
  try {
    const overview = await createFinancialDataSource(options).getFinancialOverview(accountId);
    return jsonResponse(overview);
  } catch (error) {
    if (error instanceof CashAccountRequiredError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: "Unable to load the financial overview" }, 502);
  }
}
