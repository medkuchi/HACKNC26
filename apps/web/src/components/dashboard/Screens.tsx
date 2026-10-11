"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import type { Plan, PlanStatus } from "@hacknc26/shared";
import { useDashboard, type Preferences } from "./DashboardShell";
import { Button, Icon, MetricCard, NovaMascot, PageTitle } from "./Design";
import PlanAlternatives from "./PlanAlternatives";
import type { PlanAlternative } from "@/types/alternatives";

function money(value: number | undefined, currency = "USD") {
  return value === undefined ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}
function date(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
function Notice() {
  const data = useDashboard();
  const errors = [...new Set([data.accountError, data.plans.error, data.error].filter(Boolean))];
  return <>{errors.length > 0 && <section className="card coral-card" role="alert"><h2>Connection needs attention</h2>{errors.map(error => <p key={error}>{error}</p>)}<Button secondary onClick={data.refreshAll}>Try again</Button> <Link href="/dashboard/settings">Check your account ID</Link></section>}
    {(data.accountLoading || data.plans.loading || data.loading) && <p role="status">Loading your financial outlook…</p>}</>;
}
function RangeSelector() {
  const { preferences, setRange } = useDashboard();
  return <div className="segmented" aria-label="Forecast range">{([7, 14, 30] as const).map(range => <button key={range} aria-pressed={range === preferences.range} className={range === preferences.range ? "active" : ""} onClick={() => setRange(range)}>{range}-day</button>)}</div>;
}
function Chart({ compact = false }: { compact?: boolean }) {
  const { forecast } = useDashboard();
  if (!forecast) return <p>No forecast available yet.</p>;
  const base = forecast.baseline.dailyBalances, scenario = forecast.postPurchase.dailyBalances;
  const values = [...base, ...scenario].map(day => day.balance).concat(0, forecast.safetyBuffer);
  const low = Math.min(...values), high = Math.max(...values), span = Math.max(high - low, 1);
  const y = (balance: number) => 10 + (high - balance) / span * 180;
  const x = (index: number) => 55 + index / Math.max(base.length - 1, 1) * 725;
  const points = (rows: typeof base) => rows.map((day, index) => `${x(index)},${y(day.balance)}`).join(" ");
  return <div className={`live-chart ${compact ? "compact" : ""}`}>
    <svg viewBox="0 0 800 230" role="img" aria-label={`Balance forecast from ${forecast.period.startDate} to ${forecast.period.endDate}; baseline minimum ${money(forecast.baseline.minimumProjectedBalance, forecast.baseline.currency)}, with plans ${money(forecast.postPurchase.minimumProjectedBalance, forecast.baseline.currency)}`}>
      {[low, (low + high) / 2, high].map((value, index) => <g key={index}><line x1="55" x2="780" y1={y(value)} y2={y(value)} stroke="#dbe8eb" /><text x="0" y={y(value) + 4} fontSize="10" fill="#6e858b">{Math.round(value)}</text></g>)}
      <line x1="55" x2="780" y1={y(forecast.safetyBuffer)} y2={y(forecast.safetyBuffer)} stroke="#936d14" strokeDasharray="3 4" />
      <polyline points={points(base)} fill="none" stroke="#087d70" strokeWidth="2.5" />
      <polyline points={points(scenario)} fill="none" stroke="#bd4239" strokeWidth="2" strokeDasharray="5 4" />
      {base.filter((_, index) => index % Math.max(1, Math.ceil(base.length / 5)) === 0 || index === base.length - 1).map(day => <text key={day.date} x={x(base.indexOf(day))} y="220" textAnchor="middle" fontSize="10" fill="#6e858b">{date(day.date)}</text>)}
    </svg><div className="legend"><span className="teal-line">Baseline</span><span className="red-line">With active plans</span><span>Safety buffer: {money(forecast.safetyBuffer, forecast.baseline.currency)}</span></div>
  </div>;
}
function Bills() {
  const { overview } = useDashboard();
  const bills = overview?.bills.filter(bill => bill.status === "pending" || bill.status === "recurring") ?? [];
  return <div className="bill-list">{bills.map(bill => <div className="bill-row" key={bill._id}><span className="icon-tile"><Icon name="calendar" size={16} /></span><div><strong>{bill.nickname ?? bill.payee}</strong><small>{bill.status} · {bill.payment_date ? date(bill.payment_date) : `Monthly on day ${bill.recurring_date}`}</small></div><b>{money(bill.payment_amount, overview?.currency)}</b></div>)}{!bills.length && <p>No upcoming bills returned for this account.</p>}</div>;
}
function Metrics() {
  const { overview, forecast } = useDashboard();
  const currency = overview?.currency;
  return <div className="metrics-grid">
    <MetricCard title="Current account balance" value={money(overview?.currentBalance, currency)} note={overview?.account.nickname ?? "Waiting for account"} />
    <MetricCard title="Upcoming obligations" value={money(forecast?.baseline.dailyBalances.reduce((sum, day) => sum + day.expenses, 0), currency)} note="Within the selected forecast period" />
    <MetricCard title="Baseline minimum" value={money(forecast?.baseline.minimumProjectedBalance, currency)} note="Before active spending plans" tone="gold" />
    <MetricCard title="Minimum with plans" value={money(forecast?.postPurchase.minimumProjectedBalance, currency)} note="Estimated daily ending balance" tone={forecast && forecast.postPurchase.minimumProjectedBalance < 0 ? "red" : undefined} />
  </div>;
}
export function OverviewScreen() {
  const { preferences, overview, forecast, plans } = useDashboard();
  const [showAlternatives, setShowAlternatives] = useState(false);
  const active = plans.plans.filter(plan => plan.status === "tentative" || plan.status === "confirmed");
  return <><section className="welcome-band"><div><h1>Welcome back, {preferences.name.split(" ")[0]}! Here’s your financial outlook.</h1><p>See your upcoming bills and how your spending plans change your balance.</p><small>{overview ? `${overview.dataSource === "mock" ? "Mock demo" : "Nessie simulation"} · Updated ${new Date(overview.fetchedAt).toLocaleString("en-US")} · ${overview.currency}` : "Connecting to your financial account"}</small></div><NovaMascot variant="dashboard" size={112} /></section>
    <Notice /><Metrics />
    <section className="summary-strip"><div><span>Safety buffer</span><strong>{money(preferences.safetyBuffer, overview?.currency)}</strong><small>Your preferred minimum balance</small></div><div><span>Active spending plans</span><strong>{active.length} plans</strong><small>Tentative and confirmed</small></div><div><span>Current financial risk</span><strong className="gold">{forecast ? forecast.postPurchase.minimumProjectedBalance < preferences.safetyBuffer ? "Buffer at risk" : "Within buffer" : "Awaiting forecast"}</strong><small>Based on the selected {preferences.range}-day period</small></div></section>
    <div className="overview-grid"><section className="card forecast-panel"><div className="card-title"><div><h2>Your financial forecast</h2><p>Baseline compared with your active plans</p></div><RangeSelector /></div><Chart compact /><div className="forecast-footer"><div><strong>Forecasts update when plans change</strong><span>Estimated balances · simulated account</span></div><Link href="/dashboard/forecast">View full forecast →</Link></div></section><aside className="side-stack"><section className="card"><div className="card-title"><h2>Upcoming bills</h2><Link href="/dashboard/transactions#upcoming-obligations">View all</Link></div><Bills /></section><section className="card insights"><div className="card-title"><h2>Nova insights</h2><NovaMascot variant="financial" size={44} /></div><div className="insight"><b>PLANS TO REVIEW</b><strong>{plans.plans.filter(plan => plan.status === "tentative").length} tentative plans</strong><span>Review estimates before confirming.</span></div><Link href="/dashboard/action-center">Visit Action Center →</Link></section></aside></div>
    {forecast && forecast.postPurchase.minimumProjectedBalance < preferences.safetyBuffer && <section className="risk-callout"><span className="icon-tile coral"><Icon name="alert" /></span><div><strong>Your projected balance falls below your buffer</strong><p>Lowest balance with plans: {money(forecast.postPurchase.minimumProjectedBalance, overview?.currency)}.</p></div><button type="button" className="button" aria-expanded={showAlternatives} onClick={() => setShowAlternatives(value => !value)}>{showAlternatives ? "Close alternatives" : "Explore alternatives →"}</button></section>}
    {showAlternatives && <div className="overview-alternatives"><ForecastAlternatives initialPlanId={active[0]?.id} /></div>}
  </>;
}
function AlternativesForPlan({ plan, onApplied }: { plan: Plan; onApplied?: () => void }) {
  const { preferences, plans } = useDashboard();
  // Refresh a comparison when another plan changes, without regenerating on every poll.
  const contextKey = JSON.stringify(plans.plans.map(item => [item.id, item.estimatedCost, item.expectedDate, item.status, item.currency]));
  async function apply(option: PlanAlternative) {
    await plans.updatePlan(plan.id, option.action === "cancel"
      ? { status: "canceled" }
      : { estimatedCost: option.estimatedCost, expectedDate: option.expectedDate! });
    onApplied?.();
  }
  return <PlanAlternatives key={`${plan.id}:${contextKey}`} plan={plan} accountId={preferences.accountId}
    range={preferences.range} safetyBuffer={preferences.safetyBuffer} onApply={apply} />;
}

export function PlansScreen() {
  const { plans, overview } = useDashboard();
  const [filter, setFilter] = useState("all"), [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Plan | "new" | null>(null);
  const [alternativesPlanId, setAlternativesPlanId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const active = plans.plans.filter(plan => ["tentative", "confirmed"].includes(plan.status));
  const visible = plans.plans.filter(plan => (filter === "all" || plan.status === filter) && `${plan.name} ${plan.category}`.toLowerCase().includes(search.toLowerCase()));
  async function mutate(action: () => Promise<unknown>) { setFailure(null); try { await action(); } catch (error) { setFailure(error instanceof Error ? error.message : "Unable to save plan"); } }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    await mutate(async () => {
      const input = { name: String(fields.get("name")), estimatedCost: Number(fields.get("cost")), expectedDate: String(fields.get("date")), category: String(fields.get("category")), status: String(fields.get("status")) as PlanStatus, currency: editor && editor !== "new" ? editor.currency : overview?.currency ?? "USD" };
      if (editor && editor !== "new") await plans.updatePlan(editor.id, input); else await plans.createPlan(input);
      setEditor(null);
    });
  }
  return <><PageTitle title="My Plans" mascotVariant="onboarding" action={<Button onClick={() => setEditor("new")}>Add plan</Button>}>Turn “maybe” into a clearer decision. Review detected ideas or add a plan of your own.</PageTitle><Notice />{failure && <p role="alert" className="red">{failure}</p>}
    <section className="plan-summary"><div><span>Active plans</span><strong>{active.length}</strong><small>Tentative and confirmed</small></div><div><span>Needs your review</span><strong>{plans.plans.filter(plan => plan.status === "tentative").length}</strong><small>Tentative · not paid</small></div><div><span>Confirmed plans</span><strong>{plans.plans.filter(plan => plan.status === "confirmed").length}</strong><small>Included in the active-plan scenario</small></div></section>
    {editor && <form className="card preference-card" key={editor === "new" ? "new" : editor.id} onSubmit={submit}><div><h2>{editor === "new" ? "Add a spending plan" : "Edit plan"}</h2></div><label><span>Name</span><input name="name" required maxLength={200} defaultValue={editor === "new" ? "" : editor.name} /></label><label><span>Estimated cost ({editor !== "new" ? editor.currency : overview?.currency ?? "USD"})</span><input name="cost" type="number" min="0" step="0.01" required defaultValue={editor === "new" ? "" : editor.estimatedCost} /></label><label><span>Expected date</span><input name="date" type="date" required defaultValue={editor === "new" ? "" : editor.expectedDate} /></label><label><span>Category</span><input name="category" required defaultValue={editor === "new" ? "Other" : editor.category} /></label><label><span>Status</span><select name="status" defaultValue={editor === "new" ? "tentative" : editor.status}>{["tentative", "confirmed", "canceled", "completed"].map(status => <option key={status}>{status}</option>)}</select></label><div className="save-row"><button className="button" disabled={plans.saving} type="submit">{plans.saving ? "Saving…" : "Save plan"}</button><Button secondary onClick={() => setEditor(null)}>Cancel</Button></div></form>}
    <div className="filter-row"><div className="chips">{["all", "tentative", "confirmed", "canceled", "completed"].map(option => <button key={option} className={filter === option ? "active" : ""} aria-pressed={filter === option} onClick={() => setFilter(option)}>{option}</button>)}</div><label className="search"><Icon name="search" size={16} /><input aria-label="Search plans" placeholder="Search plans or categories" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
    <div className="plan-list">
      {visible.map(plan => <article className="plan-card" key={plan.id} id={`plan-${plan.id}`}>
        <div className="plan-card-top"><span className="status">{plan.status}</span><div>
          <button disabled={plans.saving} onClick={() => setEditor(plan)}>Edit</button>
          <button disabled={plans.saving} onClick={() => void mutate(() => plans.updatePlan(plan.id, { status: "canceled" }))}>Dismiss</button>
        </div></div>
        <div className="plan-main"><div><h2>{plan.name}</h2><span>{date(plan.expectedDate)} · {plan.category}</span></div><strong>{money(plan.estimatedCost, plan.currency)}</strong></div>
        <div className="plan-details">
          <div><span>Estimated cost</span><b>{money(plan.estimatedCost, plan.currency)}</b></div>
          <div><span>Expected date</span><b>{date(plan.expectedDate)}</b></div>
          <div><span>Source</span><b>{plan.source.replaceAll("_", " ")}</b></div>
          <div><span>Risk score</span><b>{plan.riskScore === null ? "Not assessed" : `${plan.riskScore}/100`}</b></div>
        </div>
        <div className="plan-actions">
          <span>{plan.projectedImpact === null ? "Review the forecast to compare active plans" : `Projected impact: ${money(plan.projectedImpact, plan.currency)}`}</span>
          <button type="button" className="button" disabled={plans.saving || !["tentative", "confirmed"].includes(plan.status)}
            aria-expanded={alternativesPlanId === plan.id} aria-controls={`alternatives-${plan.id}`}
            onClick={() => setAlternativesPlanId(current => current === plan.id ? null : plan.id)}>
            {alternativesPlanId === plan.id ? "Close alternatives" : "Explore alternatives →"}
          </button>
          <Link className="button button-secondary" href="/dashboard/forecast#forecast-chart">View forecast</Link>
        </div>
        {alternativesPlanId === plan.id && ["tentative", "confirmed"].includes(plan.status) && <div id={`alternatives-${plan.id}`}>
          <AlternativesForPlan plan={plan} onApplied={() => setAlternativesPlanId(null)} />
        </div>}
      </article>)}
      {!plans.loading && !visible.length && <section className="card empty-message"><NovaMascot variant="empty" size={84} /><p>No plans match this filter. Add a plan to see its projected impact.</p></section>}
    </div>
  </>;
}
function ForecastAlternatives({ initialPlanId }: { initialPlanId?: string }) {
  const { plans } = useDashboard();
  const [selectedId, setSelectedId] = useState(initialPlanId ?? "");
  const [openedId, setOpenedId] = useState<string | null>(initialPlanId ?? null);
  const active = plans.plans.filter(plan => ["tentative", "confirmed"].includes(plan.status));
  const selected = active.find(plan => plan.id === selectedId) ?? active[0];
  return <section className="card mint-card" id="alternatives">
    <h2>Compare your options</h2>
    <p>Ask Nova for alternatives to a spending plan and compare their projected impact.</p>
    {selected ? <>
      <label className="alternatives-plan-picker"><span>Choose a plan</span>
        <select value={selected.id} onChange={event => { setSelectedId(event.target.value); setOpenedId(null); }}>
          {active.map(plan => <option key={plan.id} value={plan.id}>{plan.name} · {money(plan.estimatedCost, plan.currency)}</option>)}
        </select>
      </label>
      {openedId === selected.id ? <AlternativesForPlan plan={selected} onApplied={() => setOpenedId(null)} />
        : <button type="button" className="button" disabled={plans.saving} onClick={() => setOpenedId(selected.id)}>Explore alternatives →</button>}
    </> : <p>Add an active plan to explore alternatives.</p>}
  </section>;
}

export function ForecastScreen() {
  const { forecast, preferences, overview } = useDashboard();
  return <><PageTitle eyebrow="A clearer look ahead" title="Financial Forecast" mascotVariant="financial">See what’s scheduled and how active plans change your balance.</PageTitle><Notice /><Metrics /><section className="card large-chart" id="forecast-chart"><div className="card-title"><div><h2>Your balance, day by day</h2><p>{forecast ? `${date(forecast.period.startDate)}–${date(forecast.period.endDate)} · Daily ending balance · ${forecast.baseline.currency}` : "Select an account to view its forecast"}</p></div><RangeSelector /></div><Chart /></section>
    <div className="forecast-bottom"><section className="card table-card" id="forecast-assumptions"><div className="card-title"><div><h2>What shapes this forecast</h2><p>Baseline includes scheduled bills. The scenario adds tentative and confirmed plans. No income is assumed unless supplied to the API.</p></div></div><div className="data-table"><div className="table-row table-head"><span>Date</span><span>Income</span><span>Obligations</span><span>Baseline</span><span>With plans</span></div>{forecast?.baseline.dailyBalances.map((day, index) => <div className={`table-row ${forecast.postPurchase.dailyBalances[index].balance < 0 ? "highlight" : ""}`} key={day.date}><span>{date(day.date)}</span><span>{money(day.income, overview?.currency)}</span><span>{money(day.expenses, overview?.currency)}</span><span>{money(day.balance, overview?.currency)}</span><span>{money(forecast.postPurchase.dailyBalances[index].balance, overview?.currency)}</span></div>)}</div></section><aside className="option-column"><section className="card coral-card"><span className="eyebrow red">Forecast assumptions</span><h2>Estimates help you plan ahead.</h2><p>Safety buffer: {money(preferences.safetyBuffer, overview?.currency)}. Only plans in the account currency enter this forecast; canceled and completed plans are excluded. Risk scores are heuristics.</p></section><ForecastAlternatives /></aside></div></>;
}
export function TransactionsScreen() {
  const { overview } = useDashboard();
  const [search, setSearch] = useState(""), [range, setRange] = useState("all");
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - Number(range));
  const purchases = overview?.purchases.filter(item => `${item.description ?? ""} ${item.merchant_id}`.toLowerCase().includes(search.toLowerCase()) && (range === "all" || new Date(item.purchase_date) >= cutoff)) ?? [];
  return <><PageTitle title="Transactions" mascotVariant="financial">Account purchase history stays separate from tentative spending plans.</PageTitle><Notice /><section className="account-band"><div><span>{overview?.account.nickname ?? "Selected account"}</span><strong>{money(overview?.currentBalance, overview?.currency)}</strong><small>Current account snapshot</small></div><div><span>Data source</span><strong>{overview?.dataSource ?? "—"}</strong><small>Simulated banking data</small></div></section><div className="transaction-tools"><label className="search"><Icon name="search" size={16} /><input aria-label="Search transactions" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search merchant or description" /></label><label><span>Date range</span><select aria-label="Transaction date range" value={range} onChange={event => setRange(event.target.value)}><option value="all">All history</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label></div><section className="card table-card transaction-table"><div className="card-title"><div><h2>Purchase history</h2><p>Historical purchases are not deducted again in the forecast.</p></div></div><div className="data-table"><div className="table-row table-head"><span>Date</span><span>Description</span><span>Merchant</span><span>Amount</span><span>Status</span></div>{purchases.map(item => <div className="table-row" key={item._id}><span>{date(item.purchase_date)}</span><span>{item.description ?? "Purchase"}</span><span>{item.merchant_id}</span><span>{money(item.amount, overview?.currency)}</span><span>{item.status}</span></div>)}</div>{!purchases.length && <p>No transactions match this account and filter.</p>}</section><section className="card obligations" id="upcoming-obligations"><div className="card-title"><h2>Upcoming obligations</h2></div><Bills /></section></>;
}
export function ActionCenterScreen() {
  const { plans, forecast, preferences, overview } = useDashboard();
  const tentative = plans.plans.filter(plan => plan.status === "tentative");
  const risk = forecast && forecast.postPurchase.minimumProjectedBalance < preferences.safetyBuffer;
  return <><PageTitle title="Action Center" mascotVariant="risk-alert">A focused place for plan decisions and forecast changes that may need you.</PageTitle><Notice /><div className="action-layout"><div className="action-feed">{risk && <article className="action-card urgent"><div className="action-icon"><Icon name="alert" /></div><div><span className="eyebrow red">Buffer at risk</span><h2>Your projected low point is {money(forecast.postPurchase.minimumProjectedBalance, overview?.currency)}</h2><p>Compare plan timing or lower estimated costs to protect your safety buffer.</p><Link className="button" href="/dashboard/forecast">Compare forecast</Link></div></article>}{tentative.map(plan => <article className="action-card" key={plan.id}><div className="action-icon"><Icon name="wallet" /></div><div><span className="eyebrow">Plan review</span><h2>{plan.name}</h2><p>{money(plan.estimatedCost, plan.currency)} · {date(plan.expectedDate)} · Review the estimate before confirming.</p><Link className="button" href={`/dashboard/plans#plan-${plan.id}`}>Review details</Link></div></article>)}{!tentative.length && !risk && <section className="card"><h2>You’re up to date</h2><p>No tentative plans or forecast buffer alerts to review.</p></section>}</div><aside className="action-sidebar"><section className="card"><h2>Your outlook at a glance</h2><div className="week-stat"><strong>{tentative.length}</strong><span>plans to review</span></div><div className="week-stat"><strong>{overview?.bills.filter(bill => ["pending", "recurring"].includes(bill.status)).length ?? 0}</strong><span>upcoming bills</span></div></section><section className="card mint-card nova-note"><NovaMascot variant="success" size={84} /><div><h2>You’re in control</h2><p>Reviewing a forecast never moves money.</p></div></section></aside></div></>;
}
export function SettingsScreen() {
  const { preferences, savePreferences } = useDashboard();
  const [message, setMessage] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    const value: Preferences = { name: String(fields.get("name")).trim(), workspace: String(fields.get("workspace")).trim(), accountId: String(fields.get("accountId")).trim(), safetyBuffer: Number(fields.get("buffer")), range: Number(fields.get("range")) as 7 | 14 | 30 };
    if (!value.name || !value.workspace || !value.accountId || !Number.isFinite(value.safetyBuffer) || value.safetyBuffer < 0) { setMessage("Enter a name, workspace, account ID, and valid safety buffer."); return; }
    try { savePreferences(value); setMessage("Changes saved on this browser."); } catch { setMessage("Unable to save browser preferences."); }
  }
  return <><PageTitle eyebrow="Make Bridge work for you" title="Settings">Manage your workspace, selected account, and forecast assumptions.</PageTitle><div className="settings-layout"><aside className="settings-nav card"><div className="profile-large"><NovaMascot size={48} /><div><strong>{preferences.name}</strong><small>{preferences.workspace}</small></div></div><Link href="#settings-general">General</Link><Link href="#settings-forecast">Forecast preferences</Link><Link href="/dashboard/nova">Nova / iMessage</Link></aside><div className="settings-content"><form key={JSON.stringify(preferences)} className="card preference-card" onSubmit={submit} id="settings-general"><div><span className="eyebrow">General</span><h2>Account experience</h2><p>Preferences are saved in this browser. Account and forecast data come from the existing APIs.</p></div><label><span>Display name</span><input name="name" required defaultValue={preferences.name} /></label><label><span>Workspace name</span><input name="workspace" required defaultValue={preferences.workspace} /></label><label><span>Nessie account ID</span><input name="accountId" required defaultValue={preferences.accountId} /></label><label id="settings-forecast"><span>Safety buffer</span><input name="buffer" type="number" min="0" step="0.01" required defaultValue={preferences.safetyBuffer} /></label><label><span>Forecast range</span><select name="range" defaultValue={preferences.range}>{[7, 14, 30].map(range => <option key={range} value={range}>{range} days</option>)}</select></label><div className="save-row"><button type="submit" className="button">Save changes</button><span role="status">{message}</span></div></form><section className="card mint-card"><h2>Privacy & connections</h2><p>Bank data is simulated. Messaging setup remains available through the existing Nova and onboarding routes.</p><Link href="/dashboard/nova">Nova / iMessage →</Link></section></div></div></>;
}
