"use client";

import { useEffect, useRef, useState } from "react";
import type { Plan } from "@hacknc26/shared";
import type { AlternativeForecastSummary, AlternativeOption, PlanAlternativesResponse } from "../../types/alternatives";

export interface PlanAlternativesProps {
  plan: Plan;
  accountId: string;
  range: 7 | 14 | 30 | 60 | 90;
  safetyBuffer: number;
  /** The parent persists an option only after the user explicitly chooses it. */
  onApply: (option: AlternativeOption) => Promise<void>;
  autoGenerate?: boolean;
}

interface GenerationState {
  key: string | null;
  phase: "idle" | "loading" | "ready" | "error";
  result: PlanAlternativesResponse | null;
  error: string | null;
}
interface ApplicationState {
  key: string;
  optionId: string;
  phase: "applying" | "applied" | "error";
}

/** Generate suggestions without changing a plan, then let the user choose. */
export default function PlanAlternatives({ plan, accountId, range, safetyBuffer, onApply,
  autoGenerate = true }: PlanAlternativesProps) {
  // Stable plan values prevent polling from restarting a Gemini request.
  const requestKey = JSON.stringify({ planId: plan.id, userId: plan.userId, name: plan.name,
    estimatedCost: plan.estimatedCost, expectedDate: plan.expectedDate, category: plan.category,
    status: plan.status, currency: plan.currency, accountId: accountId.trim(), range, safetyBuffer });
  const [state, setState] = useState<GenerationState>({ key: null, phase: "idle", result: null, error: null });
  const [revision, setRevision] = useState({ key: null as string | null, value: 0 });
  const [application, setApplication] = useState<ApplicationState | null>(null);
  const [applying, setApplying] = useState(false);
  const applyingRef = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    setApplication(null);
    if (!autoGenerate && revision.key !== requestKey) {
      setState({ key: requestKey, phase: "idle", result: null, error: null });
      return;
    }
    const controller = new AbortController();
    setState({ key: requestKey, phase: "loading", result: null, error: null });
    async function generate() {
      let failureMessage = "Breezey couldn’t generate alternatives. Please try again.";
      try {
        const response = await fetch(`/api/plans/${encodeURIComponent(plan.id)}/alternatives`, {
          method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({ accountId: accountId.trim(), range, safetyBuffer, startDate: localToday() }),
        });
        const payload: unknown = await response.json();
        if (!response.ok) {
          // The endpoint exposes fixed, validated errors, including an
          // out-of-period plan. Provider exceptions never reach this UI.
          if (object(payload) && typeof payload.error === "string" && payload.error.length <= 500) {
            failureMessage = payload.error;
          }
          throw new Error("Alternatives request failed");
        }
        if (!isResponse(payload) || payload.planId !== plan.id ||
            payload.currency !== plan.currency || payload.safetyBuffer !== safetyBuffer) {
          throw new Error("Invalid alternatives response");
        }
        if (!controller.signal.aborted) setState({ key: requestKey, phase: "ready", result: payload, error: null });
      } catch {
        if (!controller.signal.aborted) setState({ key: requestKey, phase: "error", result: null, error: failureMessage });
      }
    }
    void generate();
    return () => controller.abort();
  }, [requestKey, revision, autoGenerate]);

  const current = state.key === requestKey;
  const result = current ? state.result : null;
  const phase = current ? state.phase : autoGenerate ? "loading" : "idle";
  const currentApplication = application?.key === requestKey ? application : null;

  async function apply(option: AlternativeOption) {
    // The result must still belong to this plan and forecast settings. The ref
    // also prevents rapid clicks from submitting two edits before a render.
    if (!current || !result || phase !== "ready" || applyingRef.current ||
        currentApplication?.phase === "applied" || !result.options.includes(option)) return;
    applyingRef.current = true;
    setApplying(true);
    setApplication({ key: requestKey, optionId: option.id, phase: "applying" });
    try {
      await onApply(option);
      if (mounted.current) setApplication({ key: requestKey, optionId: option.id, phase: "applied" });
    } catch {
      if (mounted.current) setApplication({ key: requestKey, optionId: option.id, phase: "error" });
    } finally {
      applyingRef.current = false;
      if (mounted.current) setApplying(false);
    }
  }

  return <section className="plan-alternatives" aria-label={`Alternatives for ${plan.name}`} aria-busy={phase === "loading"}>
    <div className="alternatives-heading"><div><h3>Alternatives for {plan.name}</h3>
      <p>Compare ideas and their estimated impact on your {range}-day forecast.</p></div>
      <button type="button" className="button button-secondary" disabled={phase === "loading" || applying}
        onClick={() => setRevision(value => ({ key: requestKey, value: value.value + 1 }))}>
        {phase === "loading" ? "Generating…" : phase === "error" ? "Try again" : result ? "Generate again" : "Generate alternatives"}
      </button>
    </div>
    {phase === "loading" && <p className="alternatives-status" role="status">Breezey is generating alternatives and comparing their forecasts…</p>}
    {phase === "error" && <p className="alternatives-status red" role="alert">{state.error}</p>}
    {result && <><p className="alternatives-source">{result.generationSource === "gemini" ? "Gemini suggestions" : "Demo suggestions"}
      {" · "}Forecast uses simulated account data{" · "}
      {formatDate(result.period.startDate)}–{formatDate(result.period.endDate)}</p>
      <div className="alternatives-list">{result.options.map(option => <article className="alternative-card" key={option.id}>
        <h4>{option.title}</h4><p>{option.explanation}</p>
        <dl className="alternative-details"><div><dt>Estimated cost</dt><dd>{money(option.estimatedCost, result.currency)}</dd></div>
          <div><dt>Expected date</dt><dd>{option.expectedDate ? formatDate(option.expectedDate) : "Plan dismissed"}</dd></div>
          <div><dt>Estimated savings</dt><dd>{money(option.savings, result.currency)}</dd></div></dl>
        <dl className="alternative-metrics"><div><dt>Lowest balance</dt><dd>{money(option.before.minimumProjectedBalance, result.currency)} → {money(option.after.minimumProjectedBalance, result.currency)}</dd></div>
          <div><dt>Shortfall below $0</dt><dd>{money(option.before.maximumProjectedShortfall, result.currency)} → {money(option.after.maximumProjectedShortfall, result.currency)}</dd></div>
          <div><dt>Lowest balance improvement</dt><dd>{money(option.after.minimumProjectedBalance - option.before.minimumProjectedBalance, result.currency)}</dd></div>
          <div><dt>Shortfall reduction</dt><dd>{money(option.before.maximumProjectedShortfall - option.after.maximumProjectedShortfall, result.currency)}</dd></div></dl>
        <p className="alternatives-status">{option.after.bufferRisk ? "Still below" : "Meets"} your {money(result.safetyBuffer, result.currency)} safety buffer.
          {option.after.firstNegativeDate && ` First negative balance: ${formatDate(option.after.firstNegativeDate)}.`}</p>
        <div className="alternatives-actions"><button type="button" className="button"
          disabled={applying || currentApplication?.phase === "applied"}
          onClick={() => void apply(option)}>
          {currentApplication?.optionId === option.id && currentApplication.phase === "applying" ? "Applying…" :
            currentApplication?.optionId === option.id && currentApplication.phase === "applied" ? "Applied" :
              option.action === "cancel" ? "Dismiss plan" : "Apply alternative"}
        </button></div>
      </article>)}</div>
      {currentApplication?.phase === "error" && <p className="alternatives-status red" role="alert">The alternative couldn’t be saved. Try applying it again.</p>}
      {currentApplication?.phase === "applied" && <p className="alternatives-status" role="status">Plan updated. Your forecast will refresh.</p>}
    </>}
  </section>;
}

function localToday(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}
function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}
function formatDate(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function isSummary(value: unknown): value is AlternativeForecastSummary {
  return object(value) && finite(value.minimumProjectedBalance) && finite(value.remainingAfterObligations) &&
    finite(value.maximumProjectedShortfall) && value.maximumProjectedShortfall >= 0 &&
    (value.firstNegativeDate === null || typeof value.firstNegativeDate === "string") && typeof value.bufferRisk === "boolean";
}
function isResponse(value: unknown): value is PlanAlternativesResponse {
  if (!object(value) || typeof value.planId !== "string" || typeof value.currency !== "string" ||
      !object(value.period) || typeof value.period.startDate !== "string" || typeof value.period.endDate !== "string" ||
      !finite(value.safetyBuffer) || !["mock", "nessie"].includes(String(value.dataSource)) ||
      !["mock", "gemini"].includes(String(value.generationSource)) || !isSummary(value.currentForecast) ||
      !Array.isArray(value.options) || value.options.length === 0) return false;
  const ids = new Set<string>();
  return value.options.every(option => {
    if (!object(option) || typeof option.id !== "string" || ids.has(option.id) ||
        typeof option.title !== "string" || typeof option.explanation !== "string" ||
        !["adjust", "cancel"].includes(String(option.action)) || !finite(option.estimatedCost) || option.estimatedCost < 0 ||
        !finite(option.savings) || (option.action === "adjust" ? typeof option.expectedDate !== "string" : option.expectedDate !== null) ||
        !isSummary(option.before) || !isSummary(option.after)) return false;
    ids.add(option.id);
    return true;
  });
}
