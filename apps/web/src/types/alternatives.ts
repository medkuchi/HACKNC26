import type { ForecastPeriod } from "@hacknc26/shared";

/** Server-calculated balances; Gemini supplies proposals, never these values. */
export interface AlternativeForecastSummary {
  minimumProjectedBalance: number;
  remainingAfterObligations: number;
  maximumProjectedShortfall: number;
  firstNegativeDate: string | null;
  bufferRisk: boolean;
}

export interface PlanAlternative {
  id: string;
  title: string;
  explanation: string;
  action: "adjust" | "cancel";
  estimatedCost: number;
  /** Null when canceling; adjustments stay within the displayed forecast. */
  expectedDate: string | null;
  savings: number;
  before: AlternativeForecastSummary;
  after: AlternativeForecastSummary;
}

export type AlternativeOption = PlanAlternative;

export interface PlanAlternativesResponse {
  planId: string;
  period: ForecastPeriod;
  currency: string;
  safetyBuffer: number;
  dataSource: "mock" | "nessie";
  generationSource: "gemini" | "mock";
  currentForecast: AlternativeForecastSummary;
  options: PlanAlternative[];
}

export interface PlanAlternativesRequest {
  accountId: string;
  range: 7 | 14 | 30;
  safetyBuffer: number;
  startDate?: string;
}
