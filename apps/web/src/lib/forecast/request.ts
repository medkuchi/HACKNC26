import type { ForecastEvent, ForecastPlannedPurchase, ForecastRecurringExpense } from "@hacknc26/shared";
import type { ForecastSetup } from "../nessie/adapters";

type Row = Record<string, unknown>;
function object(value: unknown): Row {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Expected a JSON object");
  return value as Row;
}
function text(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${field} must be a nonempty string`);
  return value.trim();
}
function amount(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${field} must be a finite, nonnegative number`);
  }
  return value;
}
function date(value: unknown, field: string): string {
  const result = text(value, field);
  const parsed = new Date(`${result}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== result) throw new TypeError(`${field} must be a valid YYYY-MM-DD date`);
  return result;
}
function event(value: unknown): ForecastEvent {
  const row = object(value);
  if (row.amountIsEstimated !== undefined && typeof row.amountIsEstimated !== "boolean") {
    throw new TypeError("amountIsEstimated must be a boolean");
  }
  return { id: text(row.id, "id"), name: text(row.name, "name"), amount: amount(row.amount, "amount"),
    expectedDate: date(row.expectedDate, "expectedDate"), amountIsEstimated: row.amountIsEstimated ?? true };
}
function list<T extends ForecastEvent>(value: unknown, parse: (item: unknown) => T): T[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new TypeError("Forecast events must be arrays");
  const results = value.map(parse);
  if (new Set(results.map(item => item.id)).size !== results.length) throw new TypeError("Forecast event IDs must be unique within each list");
  return results;
}
function purchase(value: unknown): ForecastPlannedPurchase {
  const row = object(value);
  const status = row.status;
  if (status !== "tentative" && status !== "confirmed" && status !== "canceled" && status !== "completed") {
    throw new TypeError("Invalid planned purchase status");
  }
  return { ...event(row), status };
}
function recurring(value: unknown): ForecastRecurringExpense {
  const row = object(value);
  const frequency = row.frequency;
  if (frequency !== "weekly" && frequency !== "biweekly" && frequency !== "monthly" && frequency !== "yearly") {
    throw new TypeError("Invalid recurring expense frequency");
  }
  const result: ForecastRecurringExpense = { ...event(row), frequency };
  if (row.endDate !== undefined) {
    result.endDate = date(row.endDate, "endDate");
    if (result.endDate < result.expectedDate) throw new TypeError("Recurring expense ends before its first occurrence");
  }
  return result;
}

/** No database yet: callers supply normalized forecast events in the POST body. */
export function parseForecastRequest(value: unknown): { accountId: string; setup: ForecastSetup } {
  const row = object(value);
  const accountId = text(row.accountId, "accountId");
  const range = row.range ?? 90;
  if (range !== 7 && range !== 14 && range !== 30 && range !== 60 && range !== 90) throw new TypeError("range must be 7, 14, 30, 60, or 90");
  // Calendar dates use UTC by default; callers can supply their own local date.
  const startDate = date(row.startDate ?? new Date().toISOString().slice(0, 10), "startDate");
  const end = new Date(`${startDate}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + range - 1);
  const endDate = date(end.toISOString().slice(0, 10), "endDate");
  const safetyBuffer = amount(row.safetyBuffer ?? 100, "safetyBuffer");
  let plannedPurchases = list(row.plannedPurchases, purchase);
  if (row.planIds !== undefined) {
    if (!Array.isArray(row.planIds)) throw new TypeError("planIds must be an array of IDs supplied in plannedPurchases");
    const ids = row.planIds.map(id => text(id, "planIds"));
    if (new Set(ids).size !== ids.length) throw new TypeError("planIds must be unique");
    if (ids.some(id => !plannedPurchases.some(plan => plan.id === id))) {
      throw new TypeError("Every planId must match a supplied planned purchase");
    }
    plannedPurchases = plannedPurchases.filter(plan => ids.includes(plan.id));
  }
  const setup: ForecastSetup = { period: { startDate, endDate }, safetyBuffer,
    incomeEvents: list(row.incomeEvents, event), plannedPurchases,
    recurringExpenses: list(row.recurringExpenses, recurring) };
  return { accountId, setup };
}
