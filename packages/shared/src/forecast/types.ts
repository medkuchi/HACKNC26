/**
 * YYYY-MM-DD calendar date, without a time or timezone.
 * Adapters must validate real calendar dates at runtime.
 */
export type ForecastDate = string;

/** Inclusive forecast window; endDate must be on or after startDate. */
export interface ForecastPeriod {
  startDate: ForecastDate;
  endDate: ForecastDate;
}

/**
 * Nonnegative, finite amounts in major currency units (e.g. USD dollars).
 * An unknown amount must be estimated before creating an event; zero means
 * no charge, not missing data. IDs must distinguish individual events.
 */
export interface ForecastEvent {
  id: string;
  name: string;
  amount: number;
  expectedDate: ForecastDate;
  amountIsEstimated: boolean;
}

export type ForecastIncomeEvent = ForecastEvent;
export type ForecastBill = ForecastEvent;

export interface ForecastRecurringExpense extends ForecastEvent {
  /**
   * expectedDate anchors the schedule. Monthly/yearly occurrences keep its
   * day of month, clamping to the last day of shorter months.
   */
  frequency: "weekly" | "biweekly" | "monthly" | "yearly";
  /** Inclusive final occurrence date; omit for ongoing expenses. */
  endDate?: ForecastDate;
}

export type ForecastPlanStatus =
  | "tentative"
  | "confirmed"
  | "canceled"
  | "completed";

export interface ForecastPlannedPurchase extends ForecastEvent {
  status: ForecastPlanStatus;
}

/**
 * Normalized data supplied by Nessie/user-data adapters, not raw API responses.
 * Only unpaid future obligations belong here; the opening balance already
 * reflects settled transactions. Validate numbers and dates before forecasting.
 */
export interface ForecastInput {
  /** Opening balance before events on startDate; may be negative. */
  currentBalance: number;
  /** ISO 4217 code, e.g. USD; all events use this currency. */
  currency: string;
  bills: ForecastBill[];
  incomeEvents: ForecastIncomeEvent[];
  /** Do not duplicate these occurrences in bills. */
  recurringExpenses: ForecastRecurringExpense[];
  /**
   * Selected scenario plans; tentative and confirmed plans count when selected.
   * The engine excludes canceled/completed plans. Use [] for a no-plan baseline.
   */
  plannedPurchases: ForecastPlannedPurchase[];
  /** Nonnegative preferred minimum balance. */
  safetyBuffer: number;
  period: ForecastPeriod;
}

export interface ForecastDailyBalance {
  date: ForecastDate;
  income: number;
  /** Bills plus recurring expenses, excluding plannedPurchases. */
  expenses: number;
  plannedPurchases: number;
  /** Closing balance after all events on this date. */
  balance: number;
}

/**
 * One entry per calendar day, in ascending order, including days with no events.
 * Daily closing balances cannot describe overdrafts within a single day.
 */
export interface ForecastResult {
  currency: string;
  dailyBalances: ForecastDailyBalance[];
  /** Minimum of opening balance and daily closing balances. */
  minimumProjectedBalance: number;
  /** startDate if already overdrawn; null if never negative. */
  firstNegativeDate: ForecastDate | null;
  /** max(0, -minimumProjectedBalance); overdraft, not buffer breach. */
  maximumProjectedShortfall: number;
  /** Final day's closing balance after all included obligations. */
  remainingAfterObligations: number;
}

/** Provisional heuristic scores in [0, 100], not probabilities. */
export interface RiskScoreResult {
  baseline: number;
  postPurchase: number;
  /** postPurchase - baseline; may be negative. */
  delta: number;
}

/** Both scenarios use the same opening balance, obligations, and date window. */
export interface ForecastComparisonResult {
  baseline: ForecastResult;
  postPurchase: ForecastResult;
  /** Post-purchase final balance minus baseline final balance. */
  balanceDelta: number;
  /** balanceDelta / safetyBuffer; null when safetyBuffer is zero. */
  balanceDeltaRelativeToSafetyBuffer: number | null;
  riskScore: RiskScoreResult;
}
