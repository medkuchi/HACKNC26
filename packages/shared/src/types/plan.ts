import type { ForecastDate, ForecastPlanStatus } from "../forecast/types";

/** Reuse the forecast statuses so stored plans and forecast purchases agree. */
export type PlanStatus = ForecastPlanStatus;

export type PlanSource = "private_imessage" | "authorized_group" | "manual";

/**
 * A user's spending plan, independent of database rows and API responses.
 * Validate amounts, dates, confidence, and scores when accepting external data.
 */
export interface Plan {
  id: string;
  userId: string;
  name: string;
  /** Finite, nonnegative amount in major currency units (e.g. USD dollars). */
  estimatedCost: number;
  /** ISO 4217 code, such as USD; must match the forecast currency. */
  currency: string;
  /** Free-form category shared by manually entered and AI-detected plans. */
  category: string;
  expectedDate: ForecastDate;
  status: PlanStatus;
  source: PlanSource;
  /** AI detection confidence in [0, 1]; omit for manually entered plans. */
  confidence?: number;
  /**
   * Post-purchase final balance minus baseline final balance, in major units.
   * Spending normally makes this negative. Null until a forecast is computed;
   * clear it when the plan or underlying financial data changes.
   */
  projectedImpact: number | null;
  /**
   * Post-purchase heuristic score in [0, 100], not a probability.
   * Null until computed; invalidate alongside projectedImpact.
   */
  riskScore: number | null;
}
