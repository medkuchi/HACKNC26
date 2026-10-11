import type { Plan, PlanSource, PlanStatus } from "@hacknc26/shared";

// Route bundles and hot reloads can evaluate this module separately. Keep one
// demo map per server process; restarting the process still clears all plans.
const globalForPlans = globalThis as typeof globalThis & {
  __hacknc26DemoPlans?: Map<string, Plan>;
};
const plans = globalForPlans.__hacknc26DemoPlans ??= new Map<string, Plan>();
export const DEMO_USER_ID = "demo-user";

export interface CreatePlanInput {
  name: string;
  estimatedCost: number;
  currency: string;
  category: string;
  expectedDate: string;
  status: PlanStatus;
  source: PlanSource;
  confidence?: number;
}

/** Validate request JSON; IDs, ownership, and computed values are server-managed. */
export function parseCreatePlanInput(value: unknown): CreatePlanInput {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Request body must be a JSON object");
  }
  const row = value as Record<string, unknown>;
  const text = (value: unknown, field: string): string => {
    if (typeof value !== "string" || !value.trim()) throw new TypeError(`${field} must be a nonempty string`);
    return value.trim();
  };
  const name = text(row.name, "name");
  if (name.length > 200) throw new TypeError("name must contain at most 200 characters");
  const estimatedCost = row.estimatedCost;
  if (typeof estimatedCost !== "number" || !Number.isFinite(estimatedCost) || estimatedCost < 0) {
    throw new TypeError("estimatedCost must be a finite, nonnegative number");
  }
  const currency = text(row.currency ?? "USD", "currency").toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new TypeError("currency must be a three-letter currency code");
  const category = text(row.category ?? "other", "category");
  const expectedDate = text(row.expectedDate, "expectedDate");
  const date = new Date(`${expectedDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expectedDate) || !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== expectedDate) {
    throw new TypeError("expectedDate must be a valid YYYY-MM-DD date");
  }
  const status = row.status ?? "tentative";
  if (status !== "tentative" && status !== "confirmed" && status !== "canceled" && status !== "completed") {
    throw new TypeError("Invalid plan status");
  }
  const source = row.source ?? "manual";
  if (source !== "manual" && source !== "private_imessage" && source !== "authorized_group") {
    throw new TypeError("Invalid plan source");
  }
  const confidence = row.confidence;
  if (confidence !== undefined && (typeof confidence !== "number" || !Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
    throw new TypeError("confidence must be a number between 0 and 1");
  }
  return { name, estimatedCost, currency, category, expectedDate, status, source,
    ...(source !== "manual" && confidence !== undefined ? { confidence: confidence as number } : {}) };
}

/** Computed values can only be supplied by server code, never the CRUD parser. */
export function createPlan(input: CreatePlanInput, userId = DEMO_USER_ID,
  forecast: Pick<Plan, "projectedImpact" | "riskScore"> = { projectedImpact: null, riskScore: null }): Plan {
  if (forecast.projectedImpact !== null && !Number.isFinite(forecast.projectedImpact)) {
    throw new TypeError("projectedImpact must be finite or null");
  }
  if (forecast.riskScore !== null && (!Number.isFinite(forecast.riskScore) || forecast.riskScore < 0 || forecast.riskScore > 100)) {
    throw new TypeError("riskScore must be between 0 and 100 or null");
  }
  const plan: Plan = { ...input, id: crypto.randomUUID(), userId,
    projectedImpact: forecast.projectedImpact, riskScore: forecast.riskScore };
  plans.set(plan.id, plan);
  return { ...plan };
}

export function listPlans(userId = DEMO_USER_ID, status?: PlanStatus): Plan[] {
  return [...plans.values()]
    .filter(plan => plan.userId === userId && (status === undefined || plan.status === status))
    .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate) || a.id.localeCompare(b.id))
    .map(plan => ({ ...plan }));
}

export function getPlan(id: string, userId = DEMO_USER_ID): Plan | undefined {
  const plan = plans.get(id);
  return plan?.userId === userId ? { ...plan } : undefined;
}

/** Validate a partial edit before changing storage; null clears AI confidence. */
export function updatePlan(id: string, value: unknown, userId = DEMO_USER_ID): Plan | undefined {
  const current = getPlan(id, userId);
  if (!current) return undefined;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Request body must be a JSON object");
  }
  const patch = value as Record<string, unknown>;
  const allowed = ["name", "estimatedCost", "currency", "category", "expectedDate", "status", "source", "confidence"];
  const keys = Object.keys(patch);
  if (!keys.length) throw new TypeError("Provide at least one field to update");
  for (const key of keys) {
    if (!allowed.includes(key)) throw new TypeError(`Cannot update field: ${key}`);
    if (patch[key] === null && key !== "confidence") throw new TypeError(`${key} cannot be null`);
  }
  const merged: Record<string, unknown> = { ...current, ...patch };
  if (merged.confidence === null) delete merged.confidence;
  const input = parseCreatePlanInput(merged);
  // Forecast values become stale when a plan changes; recalculate them separately.
  const updated: Plan = { ...input, id: current.id, userId: current.userId,
    projectedImpact: null, riskScore: null };
  plans.set(id, updated);
  return { ...updated };
}

export function deletePlan(id: string, userId = DEMO_USER_ID): boolean {
  return getPlan(id, userId) !== undefined && plans.delete(id);
}
