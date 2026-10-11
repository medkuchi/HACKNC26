"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { FinancialOverview } from "@hacknc26/shared";
import { usePlans } from "@/hooks/usePlans";
import { useForecast } from "@/hooks/useForecast";
import { Icon, NovaMascot } from "./Design";
import "./dashboard.css";

export interface Preferences { accountId: string; name: string; workspace: string; safetyBuffer: number; range: 7 | 14 | 30 | 60 | 90 }
const defaults: Preferences = { accountId: "demo", name: "Demo User", workspace: "Demo workspace", safetyBuffer: 100, range: 90 };
function useDashboardData() {
  const [preferences, setPreferences] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [overview, setOverview] = useState<FinancialOverview | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  // Nova creates plans outside the browser, so keep the visible dashboard current.
  const plans = usePlans({ pollIntervalMs: 3000, refreshOnFocus: true });
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("bridge-dashboard-preferences") ?? "null");
      if (saved && typeof saved.accountId === "string" && saved.accountId.trim() &&
          typeof saved.name === "string" && typeof saved.workspace === "string" &&
          Number.isFinite(saved.safetyBuffer) && saved.safetyBuffer >= 0 && [7, 14, 30, 60, 90].includes(saved.range)) {
        const migrated = { ...saved, range: saved.forecastDefaultVersion === 90 ? saved.range : 90 };
        setPreferences(migrated);
        localStorage.setItem("bridge-dashboard-preferences", JSON.stringify({ ...migrated, forecastDefaultVersion: 90 }));
      }
    } catch { /* Missing or invalid local preferences use the demo defaults. */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setOverview(null); setAccountError(null); setAccountLoading(true);
    void (async () => {
      try {
        const response = await fetch(`/api/nessie/overview?accountId=${encodeURIComponent(preferences.accountId)}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to load account");
        if (!payload.account || !payload.customer || !Number.isFinite(payload.currentBalance) ||
            !Array.isArray(payload.bills) || !Array.isArray(payload.purchases) ||
            payload.account._id !== preferences.accountId || typeof payload.currency !== "string") throw new Error("Invalid account response");
        if (!controller.signal.aborted) setOverview(payload);
      } catch (error) {
        if (!controller.signal.aborted) setAccountError(error instanceof Error ? error.message : "Unable to load account");
      } finally { if (!controller.signal.aborted) setAccountLoading(false); }
    })();
    return () => controller.abort();
  }, [ready, preferences.accountId, refresh]);
  const forecast = useForecast({ accountId: preferences.accountId, enabled: ready && !plans.loading && !plans.error,
    range: preferences.range, safetyBuffer: preferences.safetyBuffer,
    plannedPurchases: plans.plans.filter(plan => plan.currency === (overview?.currency ?? "USD")).map(plan => ({
      id: plan.id, name: plan.name, amount: plan.estimatedCost, expectedDate: plan.expectedDate,
      amountIsEstimated: true, status: plan.status,
    })) });
  function savePreferences(value: Preferences) {
    // Save before changing state so a storage failure cannot report success.
    localStorage.setItem("bridge-dashboard-preferences", JSON.stringify({ ...value, forecastDefaultVersion: 90 }));
    setPreferences(value);
  }
  return { preferences, savePreferences, overview, accountError, accountLoading, plans, ...forecast,
    setRange: (range: 7 | 14 | 30 | 60 | 90) => setPreferences(current => ({ ...current, range })),
    refreshAll: () => { setRefresh(value => value + 1); plans.refetch(); forecast.refetch(); } };
}
type DashboardData = ReturnType<typeof useDashboardData>;
const DashboardContext = createContext<DashboardData | null>(null);
export function useDashboard() {
  const value = useContext(DashboardContext);
  if (!value) throw new Error("Dashboard provider is missing");
  return value;
}
const tabs = [
  { href: "/dashboard", label: "Overview", icon: "grid" },
  { href: "/dashboard/plans", label: "My Plans", icon: "clipboard" },
  { href: "/dashboard/forecast", label: "Financial Forecast", icon: "chart" },
  { href: "/dashboard/transactions", label: "Transactions", icon: "swap" },
  { href: "/dashboard/action-center", label: "Action Center", icon: "inbox" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
] as const;
export default function DashboardShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const data = useDashboardData();
  const { preferences, overview } = data;
  const initials = preferences.name.split(/\s+/).map(part => part[0]).join("").slice(0, 2);
  const brand = <><span className="brand-mascot"><NovaMascot size={40} label="Breezey mascot" /></span><strong>Breezey</strong></>;
  return <DashboardContext.Provider value={data}><div className="bridge-dashboard app-shell">
    <nav className="top-tabs" aria-label="Primary navigation"><div className="tabs-inner">
      <Link className="brand compact-brand" href="/dashboard">{brand}</Link>
      <div className="tab-scroll">{tabs.map(tab => <Link key={tab.href} href={tab.href} aria-current={path === tab.href ? "page" : undefined} className={path === tab.href ? "active" : ""}><Icon name={tab.icon} size={16} />{tab.label}</Link>)}</div>
    </div></nav>
    <header className="account-header"><div className="account-inner">
      <Link className="brand" href="/dashboard">{brand}</Link>
      <div className="profile"><span>{initials}</span><div><strong>{preferences.name}</strong><small>{preferences.workspace}</small></div></div>
      <div className="account-meta"><b>{overview ? overview.dataSource === "mock" ? "Mock demo account" : "Nessie simulated account" : "Account connection"}</b><button type="button" onClick={data.refreshAll}>Refresh</button><Link href="/dashboard/action-center" aria-label="Notifications"><Icon name="bell" size={17} /></Link></div>
    </div></header>
    <main className="main-content">{children}</main>
    <footer>Simulated banking data · Forecasts are estimates · <Link href="/development">API connection checks</Link></footer>
  </div></DashboardContext.Provider>;
}
