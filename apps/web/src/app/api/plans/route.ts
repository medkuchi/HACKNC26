import type { PlanStatus } from "@hacknc26/shared";
import { createPlan, DEMO_USER_ID, listPlans, parseCreatePlanInput } from "../../../lib/plans/store";
import { jsonResponse } from "../../../lib/nessie/config";

// Deferred until the Supabase client and database schema are implemented.
// import { createServerClient } from "../../../lib/supabase/server";
export const runtime = "nodejs";

/** GET /api/plans?status=tentative — all demo plans, optionally filtered by status. */
export async function GET(request: Request): Promise<Response> {
  // FUTURE AUTH:
  // const supabase = await createServerClient();
  // const { data: { user } } = await supabase.auth.getUser();
  // if (!user) return jsonResponse({ error: "Authentication required" }, 401);
  // Read spending_plans filtered by user.id instead of shared demo storage.

  const value = new URL(request.url).searchParams.get("status");
  let status: PlanStatus | undefined;
  if (value !== null) {
    if (value !== "tentative" && value !== "confirmed" && value !== "canceled" && value !== "completed") {
      return jsonResponse({ error: "Invalid plan status filter" }, 400);
    }
    status = value;
  }
  return jsonResponse({ plans: listPlans(DEMO_USER_ID, status), dataSource: "demo" });
}

/** POST /api/plans — save a manual or AI-detected plan in temporary demo storage. */
export async function POST(request: Request): Promise<Response> {
  // FUTURE AUTH: authenticate and use user.id as the owner, never a body userId.
  // const supabase = await createServerClient();
  // const { data: { user } } = await supabase.auth.getUser();
  // if (!user) return jsonResponse({ error: "Authentication required" }, 401);

  let input;
  try { input = parseCreatePlanInput(await request.json()); }
  catch (error) {
    return jsonResponse({ error: error instanceof TypeError ? error.message : "Request body must be valid JSON" }, 400);
  }
  const plan = createPlan(input, DEMO_USER_ID);

  // FUTURE PERSISTENCE: insert these values into spending_plans using user.id.
  // Map camelCase fields to the schema's snake_case fields (estimated_cost, etc.).
  // Return the saved row instead of storing the plan in this process.
  // projectedImpact/riskScore stay null until a forecast supplies them.

  return jsonResponse({ plan, dataSource: "demo" }, 201);
}
