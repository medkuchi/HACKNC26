"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Plan, PlanStatus } from "@hacknc26/shared";

export type CreatePlanInput = Pick<Plan, "name" | "estimatedCost" | "expectedDate"> &
  Partial<Pick<Plan, "currency" | "category" | "status" | "source" | "confidence">>;
export type UpdatePlanInput = Partial<Omit<CreatePlanInput, "confidence">> & { confidence?: number | null };

export interface UsePlansOptions {
  status?: PlanStatus;
  enabled?: boolean;
  /** Refresh while the page is visible; omitted disables polling. */
  pollIntervalMs?: number;
  /** Refresh when the window gains focus or the page becomes visible. */
  refreshOnFocus?: boolean;
}
export interface UsePlansResult {
  plans: Plan[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  refetch: () => void;
  /** Mutations refresh the list after success and reject on failure. */
  createPlan: (input: CreatePlanInput) => Promise<Plan>;
  updatePlan: (id: string, input: UpdatePlanInput) => Promise<Plan>;
  deletePlan: (id: string) => Promise<void>;
}
interface ListState {
  key: string | null;
  plans: Plan[];
  loading: boolean;
  hasLoaded: boolean;
  error: string | null;
}

/** Fetch plans and serialize edits so rapid actions reach the API in order. */
export function usePlans(options: UsePlansOptions = {}): UsePlansResult {
  const enabled = options.enabled !== false;
  const requestKey = enabled ? `/api/plans${options.status ? `?status=${encodeURIComponent(options.status)}` : ""}` : null;
  const pollIntervalMs = Number.isFinite(options.pollIntervalMs) && options.pollIntervalMs! > 0
    ? options.pollIntervalMs : undefined;
  const refreshOnFocus = options.refreshOnFocus === true;
  const [state, setState] = useState<ListState>({ key: null, plans: [], loading: false, hasLoaded: false, error: null });
  const [refresh, setRefresh] = useState({ revision: 0, background: false });
  const [pending, setPending] = useState(0);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const mounted = useRef(false);
  const version = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const mutations = useRef(new Set<AbortController>());
  const activeLoad = useRef<AbortController | null>(null);
  const pendingMutations = useRef(0);
  const backgroundPending = useRef(false);
  const lastRequestKey = useRef<string | null>(null);
  const refetch = useCallback(() => setRefresh(value => ({ revision: value.revision + 1, background: false })), []);

  useEffect(() => {
    mounted.current = true;
    const controllers = mutations.current;
    return () => {
      mounted.current = false;
      version.current++;
      for (const controller of controllers) controller.abort();
    };
  }, []);

  useEffect(() => {
    const currentVersion = ++version.current;
    const background = refresh.background && lastRequestKey.current === requestKey;
    lastRequestKey.current = requestKey;
    backgroundPending.current = false;
    if (!background) setMutationError(null);
    if (requestKey === null) {
      setState({ key: null, plans: [], loading: false, hasLoaded: false, error: null });
      return;
    }
    const controller = new AbortController();
    activeLoad.current = controller;
    setState(previous => ({ key: requestKey, plans: previous.key === requestKey ? previous.plans : [],
      loading: !background || previous.key !== requestKey || !previous.hasLoaded,
      hasLoaded: previous.key === requestKey && previous.hasLoaded, error: null }));
    async function load(): Promise<void> {
      try {
        const response = await fetch(requestKey!, { cache: "no-store", signal: controller.signal });
        const payload = await readResponse(response);
        if (!object(payload) || !Array.isArray(payload.plans) || !payload.plans.every(isPlan)) {
          throw new Error("The plans server returned an invalid response");
        }
        if (!controller.signal.aborted && currentVersion === version.current) {
          setState({ key: requestKey, plans: payload.plans, loading: false, hasLoaded: true, error: null });
        }
      } catch (error) {
        if (!controller.signal.aborted && currentVersion === version.current) {
          setState(previous => ({ key: requestKey, plans: previous.key === requestKey ? previous.plans : [],
            loading: false, hasLoaded: previous.key === requestKey && previous.hasLoaded, error: message(error) }));
        }
      } finally {
        if (activeLoad.current === controller) activeLoad.current = null;
      }
    }
    void load();
    return () => {
      controller.abort();
      if (activeLoad.current === controller) activeLoad.current = null;
    };
  }, [requestKey, refresh]);

  useEffect(() => {
    if (requestKey === null || (pollIntervalMs === undefined && !refreshOnFocus)) return;
    const refreshInBackground = () => {
      // Do not abort a slower request or an edit when the next timer fires.
      if (!mounted.current || document.visibilityState === "hidden" || activeLoad.current ||
          pendingMutations.current > 0 || backgroundPending.current) return;
      backgroundPending.current = true;
      setRefresh(value => ({ revision: value.revision + 1, background: true }));
    };
    const timer = pollIntervalMs === undefined ? undefined : window.setInterval(refreshInBackground, pollIntervalMs);
    if (refreshOnFocus) {
      window.addEventListener("focus", refreshInBackground);
      document.addEventListener("visibilitychange", refreshInBackground);
    }
    return () => {
      if (timer !== undefined) window.clearInterval(timer);
      if (refreshOnFocus) {
        window.removeEventListener("focus", refreshInBackground);
        document.removeEventListener("visibilitychange", refreshInBackground);
      }
    };
  }, [requestKey, pollIntervalMs, refreshOnFocus]);

  const mutate = useCallback((method: "POST" | "PATCH" | "DELETE", id?: string,
    input?: CreatePlanInput | UpdatePlanInput): Promise<Plan | null> => {
    if (!mounted.current || !enabled) return Promise.reject(new Error("The plans hook is inactive"));
    if (method !== "POST" && !id?.trim()) return Promise.reject(new Error("A plan ID is required"));
    pendingMutations.current++;
    setPending(value => value + 1);
    const operation = queue.current.then(async () => {
      if (!mounted.current) throw new Error("The plans hook is inactive");
      const controller = new AbortController();
      mutations.current.add(controller);
      setMutationError(null);
      try {
        const url = method === "POST" ? "/api/plans" : `/api/plans/${encodeURIComponent(id!)}`;
        const response = await fetch(url, { method, cache: "no-store", signal: controller.signal,
          ...(input === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) }) });
        const payload = await readResponse(response);
        let plan: Plan | null = null;
        if (method !== "DELETE") {
          if (!object(payload) || !isPlan(payload.plan)) throw new Error("The plans server returned an invalid response");
          plan = payload.plan;
        }
        if (mounted.current && !controller.signal.aborted) {
          // An older GET must not replace the list after a successful edit.
          version.current++;
          setRefresh(value => ({ revision: value.revision + 1, background: false }));
        }
        return plan;
      } catch (error) {
        if (mounted.current && !controller.signal.aborted) setMutationError(message(error));
        throw error;
      } finally {
        mutations.current.delete(controller);
      }
    });
    // A rejected edit must not prevent later queued edits from running.
    queue.current = operation.then(() => undefined, () => undefined);
    return operation.finally(() => {
      pendingMutations.current--;
      if (mounted.current) setPending(value => value - 1);
    });
  }, [enabled]);

  const createPlan = useCallback(async (input: CreatePlanInput): Promise<Plan> =>
    (await mutate("POST", undefined, input))!, [mutate]);
  const updatePlan = useCallback(async (id: string, input: UpdatePlanInput): Promise<Plan> =>
    (await mutate("PATCH", id, input))!, [mutate]);
  const deletePlan = useCallback(async (id: string): Promise<void> => { await mutate("DELETE", id); }, [mutate]);
  const current = state.key === requestKey;
  return { plans: requestKey !== null && current ? state.plans : [],
    loading: requestKey !== null && (!current || state.loading), saving: pending > 0,
    error: mutationError ?? (current ? state.error : null), refetch, createPlan, updatePlan, deletePlan };
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function message(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to load or save plans";
}
async function readResponse(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  let payload: unknown;
  try { payload = await response.json(); }
  catch { throw new Error("The plans server returned an invalid response"); }
  if (!response.ok) throw new Error(object(payload) && typeof payload.error === "string" ?
    payload.error : `Plans request failed (${response.status})`);
  return payload;
}
function isPlan(value: unknown): value is Plan {
  const finite = (item: unknown): item is number => typeof item === "number" && Number.isFinite(item);
  return object(value) && typeof value.id === "string" && typeof value.userId === "string" &&
    typeof value.name === "string" && finite(value.estimatedCost) && typeof value.currency === "string" &&
    typeof value.category === "string" && typeof value.expectedDate === "string" &&
    ["tentative", "confirmed", "canceled", "completed"].includes(String(value.status)) &&
    ["manual", "private_imessage", "authorized_group"].includes(String(value.source)) &&
    (value.confidence === undefined || finite(value.confidence)) &&
    (value.projectedImpact === null || finite(value.projectedImpact)) &&
    (value.riskScore === null || finite(value.riskScore));
}
