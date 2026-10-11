"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  ForecastComparisonResult, ForecastIncomeEvent, ForecastPeriod,
  ForecastPlannedPurchase, ForecastRecurringExpense,
} from "@hacknc26/shared";

export interface UseForecastOptions {
  /** Leave empty while onboarding has not selected/created an account yet. */
  accountId?: string | null;
  range?: 7 | 14 | 30;
  startDate?: string;
  safetyBuffer?: number;
  incomeEvents?: ForecastIncomeEvent[];
  recurringExpenses?: ForecastRecurringExpense[];
  plannedPurchases?: ForecastPlannedPurchase[];
  /** Select IDs from plannedPurchases; omitted includes all, [] includes none. */
  planIds?: string[];
  enabled?: boolean;
}

export interface ForecastResponse extends ForecastComparisonResult {
  accountId: string;
  dataSource: "mock" | "nessie";
  period: ForecastPeriod;
  safetyBuffer: number;
}

export interface UseForecastResult {
  forecast: ForecastResponse | null;
  loading: boolean;
  error: string | null;
  /** Re-fetch the latest balance and recalculate using the current settings. */
  refetch: () => void;
}

interface ForecastState {
  key: string | null;
  forecast: ForecastResponse | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetch forecasts automatically when settings change. Equivalent inline arrays
 * do not trigger repeated requests. Keep the last result only for the same
 * settings during refresh, and cancel obsolete requests on changes/unmount.
 * POST is used because income and plans are supplied directly without Supabase.
 */
export function useForecast(options: UseForecastOptions): UseForecastResult {
  const active = options.enabled !== false && Boolean(options.accountId?.trim());
  const requestKey = active ? JSON.stringify({
    accountId: options.accountId!.trim(),
    range: options.range ?? 30,
    startDate: options.startDate,
    safetyBuffer: options.safetyBuffer ?? 100,
    incomeEvents: options.incomeEvents ?? [],
    recurringExpenses: options.recurringExpenses ?? [],
    plannedPurchases: options.plannedPurchases ?? [],
    planIds: options.planIds,
  }) : null;
  const [state, setState] = useState<ForecastState>({ key: null, forecast: null, loading: false, error: null });
  const [refresh, setRefresh] = useState(0);
  const refetch = useCallback(() => setRefresh(value => value + 1), []);

  useEffect(() => {
    if (requestKey === null) {
      setState({ key: null, forecast: null, loading: false, error: null });
      return;
    }
    const controller = new AbortController();
    setState(previous => ({ key: requestKey,
      forecast: previous.key === requestKey ? previous.forecast : null,
      loading: true, error: null }));

    async function load(): Promise<void> {
      try {
        const response = await fetch("/api/forecast", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: requestKey, cache: "no-store", signal: controller.signal,
        });
        let payload: unknown;
        try { payload = await response.json(); }
        catch { throw new Error("The forecast server returned an invalid response"); }
        if (!response.ok) {
          const message = payload !== null && typeof payload === "object" && "error" in payload &&
            typeof payload.error === "string" ? payload.error : `Forecast request failed (${response.status})`;
          throw new Error(message);
        }
        if (!isForecastResponse(payload)) throw new Error("The forecast server returned an invalid response");
        if (!controller.signal.aborted) {
          setState({ key: requestKey, forecast: payload, loading: false, error: null });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState(previous => ({ key: requestKey,
            forecast: previous.key === requestKey ? previous.forecast : null,
            loading: false, error: error instanceof Error ? error.message : "Unable to load forecast" }));
        }
      }
    }
    void load();
    return () => controller.abort();
  }, [requestKey, refresh]);

  // Hide a previous account/scenario immediately, before the effect starts.
  if (requestKey === null) return { forecast: null, loading: false, error: null, refetch };
  if (state.key !== requestKey) return { forecast: null, loading: true, error: null, refetch };
  return { forecast: state.forecast, loading: state.loading, error: state.error, refetch };
}

function isForecastResponse(value: unknown): value is ForecastResponse {
  const object = (item: unknown): item is Record<string, unknown> =>
    item !== null && typeof item === "object" && !Array.isArray(item);
  const finite = (item: unknown): item is number => typeof item === "number" && Number.isFinite(item);
  const result = (item: unknown): boolean => object(item) && typeof item.currency === "string" &&
    Array.isArray(item.dailyBalances) && item.dailyBalances.every(day => object(day) &&
      typeof day.date === "string" && finite(day.balance) && finite(day.income) &&
      finite(day.expenses) && finite(day.plannedPurchases)) &&
    finite(item.minimumProjectedBalance) && finite(item.maximumProjectedShortfall) &&
    finite(item.remainingAfterObligations) && (item.firstNegativeDate === null || typeof item.firstNegativeDate === "string");
  return object(value) && typeof value.accountId === "string" &&
    (value.dataSource === "mock" || value.dataSource === "nessie") &&
    object(value.period) && typeof value.period.startDate === "string" && typeof value.period.endDate === "string" &&
    finite(value.safetyBuffer) && result(value.baseline) && result(value.postPurchase) &&
    finite(value.balanceDelta) && (value.balanceDeltaRelativeToSafetyBuffer === null || finite(value.balanceDeltaRelativeToSafetyBuffer)) &&
    object(value.riskScore) && finite(value.riskScore.baseline) && finite(value.riskScore.postPurchase) && finite(value.riskScore.delta);
}
