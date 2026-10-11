import { compareForecasts } from "@hacknc26/shared";
import { parseForecastRequest } from "../../../lib/forecast/request";
import { CashAccountRequiredError, createFinancialDataSource, toForecastInput } from "../../../lib/nessie/adapters";
import { jsonResponse, readNessieOptions } from "../../../lib/nessie/config";

// Supabase auth/preferences/plans are deferred until its client and schema exist.
// import { createServerClient } from "../../../lib/supabase/server";
export const runtime = "nodejs";

async function calculate(value: unknown): Promise<Response> {
  let parsed;
  try { parsed = parseForecastRequest(value); }
  catch (error) { return jsonResponse({ error: (error as Error).message }, 400); }

  // FUTURE AUTH:
  // const supabase = await createServerClient();
  // const { data: { user } } = await supabase.auth.getUser();
  // if (!user) return jsonResponse({ error: "Authentication required" }, 401);
  // Load the user's linked account, safety preferences, income, and plans here.
  // Use saved account ownership instead of trusting the caller's accountId.

  let options;
  try { options = readNessieOptions(); }
  catch (error) { return jsonResponse({ error: (error as Error).message }, 503); }
  let overview;
  let input;
  try {
    overview = await createFinancialDataSource(options).getFinancialOverview(parsed.accountId);
    input = toForecastInput(overview, parsed.setup);
  } catch (error) {
    if (error instanceof CashAccountRequiredError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: "Unable to load financial data for the forecast" }, 502);
  }
  try {
    const result = compareForecasts(input);
    return jsonResponse({ accountId: parsed.accountId, dataSource: overview.dataSource,
      period: input.period, safetyBuffer: input.safetyBuffer, ...result });
  } catch (error) {
    return jsonResponse({ error: error instanceof RangeError ? error.message : "Unable to calculate forecast" },
      error instanceof RangeError ? 400 : 500);
  }
}

/** GET baseline: ?accountId=...&range=7|14|30&startDate=YYYY-MM-DD&safetyBuffer=100 */
export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  if (params.has("planIds") || params.has("incomeEvents") || params.has("plannedPurchases") || params.has("recurringExpenses")) {
    return jsonResponse({ error: "Use POST with event arrays to include income, expenses, or plans; no plans are stored yet" }, 400);
  }
  const range = params.get("range");
  const safetyBuffer = params.get("safetyBuffer");
  if (range?.trim() === "" || safetyBuffer?.trim() === "") return jsonResponse({ error: "Numeric parameters cannot be empty" }, 400);
  return calculate({ accountId: params.get("accountId"), range: range === null ? undefined : Number(range),
    startDate: params.get("startDate") ?? undefined,
    safetyBuffer: safetyBuffer === null ? undefined : Number(safetyBuffer) });
}

/** POST supports incomeEvents, plannedPurchases, recurringExpenses, and optional planIds. */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: "Request body must be valid JSON" }, 400); }
  return calculate(body);
}
