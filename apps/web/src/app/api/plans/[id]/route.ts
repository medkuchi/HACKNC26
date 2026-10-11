import { deletePlan, DEMO_USER_ID, getPlan, updatePlan } from "../../../../lib/plans/store";
import { jsonResponse } from "../../../../lib/nessie/config";

// Deferred until the Supabase client and database schema are implemented.
// import { createServerClient } from "../../../../lib/supabase/server";
export const runtime = "nodejs";

// Next.js supplies dynamic route parameters asynchronously.
type PlanContext = { params: Promise<{ id: string }> };

/** GET /api/plans/:id — return one plan, including any stored forecast fields. */
export async function GET(_request: Request, context: PlanContext): Promise<Response> {
  // FUTURE AUTH:
  // const supabase = await createServerClient();
  // const { data: { user } } = await supabase.auth.getUser();
  // if (!user) return jsonResponse({ error: "Authentication required" }, 401);
  // Read spending_plans with both id and user_id = user.id instead of demo storage.
  const { id } = await context.params;
  const plan = getPlan(id, DEMO_USER_ID);
  if (!plan) return jsonResponse({ error: "Plan not found" }, 404);
  return jsonResponse({ plan, dataSource: "demo" });
}

/** PATCH /api/plans/:id — edit selected fields or change the plan's status. */
export async function PATCH(request: Request, context: PlanContext): Promise<Response> {
  // FUTURE AUTH: authenticate and scope the lookup/update to user.id.
  const { id } = await context.params;
  if (!getPlan(id, DEMO_USER_ID)) return jsonResponse({ error: "Plan not found" }, 404);
  let body: unknown;
  try { body = await request.json(); }
  catch { return jsonResponse({ error: "Request body must be valid JSON" }, 400); }
  try {
    const plan = updatePlan(id, body, DEMO_USER_ID);
    if (!plan) return jsonResponse({ error: "Plan not found" }, 404);
    // FUTURE PERSISTENCE: update only validated fields, mapping camelCase to the
    // schema's snake_case columns. Filter by both id and user_id; clear saved
    // projected_impact/risk_score until a new forecast is computed.
    return jsonResponse({ plan, dataSource: "demo" });
  } catch (error) {
    if (error instanceof TypeError) return jsonResponse({ error: error.message }, 400);
    return jsonResponse({ error: "Unable to update plan" }, 500);
  }
}

/** DELETE /api/plans/:id — remove the plan from the temporary demo store. */
export async function DELETE(_request: Request, context: PlanContext): Promise<Response> {
  // FUTURE AUTH/PERSISTENCE: authenticate, then delete spending_plans filtered
  // by both id and user_id = user.id. Never accept ownership from the request.
  const { id } = await context.params;
  if (!deletePlan(id, DEMO_USER_ID)) return jsonResponse({ error: "Plan not found" }, 404);
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
