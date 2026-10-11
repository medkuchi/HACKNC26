"use client";

import { useEffect, useRef, useState } from "react";

interface CheckResult {
  status: number | null;
  ok: boolean;
  body: string;
}

/** Temporary GET-only checks; no plans or accounts are created by this panel. */
export default function ApiChecks() {
  const [accountId, setAccountId] = useState("demo");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);

  const account = encodeURIComponent(accountId.trim() || "demo");
  const checks = [
    { name: "Account", path: `/api/nessie/account?accountId=${account}` },
    { name: "Financial overview", path: `/api/nessie/overview?accountId=${account}` },
    { name: "7-day forecast", path: `/api/forecast?accountId=${account}&range=7` },
    { name: "Spending plans", path: "/api/plans" },
  ];

  async function runChecks() {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setRunning(true);
    setResults({});
    await Promise.all(checks.map(async ({ name, path }) => {
      let result: CheckResult;
      try {
        const response = await fetch(path, { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        result = { status: response.status, ok: response.ok, body: JSON.stringify(body, null, 2) };
      } catch (error) {
        result = { status: null, ok: false, body: error instanceof Error ? error.message : "Request failed" };
      }
      if (!controller.signal.aborted) setResults(previous => ({ ...previous, [name]: result }));
    }));
    if (!controller.signal.aborted) setRunning(false);
  }

  return (
    <section className="card" aria-labelledby="api-heading">
      <div className="section-heading">
        <div><p className="eyebrow">Connection check</p><h2 id="api-heading">Test your API routes</h2></div>
        <button type="button" onClick={() => void runChecks()} disabled={running}>
          {running ? "Checking…" : "Run GET checks"}
        </button>
      </div>
      <label className="account-label" htmlFor="account-id">Account ID</label>
      <input id="account-id" value={accountId} disabled={running} onChange={event => {
        setAccountId(event.target.value);
        setResults({});
      }} />
      <p className="muted">Use “demo” with mock Nessie, or enter your account ID when using the Nessie API.</p>
      <ul className="api-list">
        {checks.map(({ name, path }) => {
          const result = results[name];
          return (
            <li key={name}>
              <div className="api-row">
                <div><strong>{name}</strong><a href={path} target="_blank" rel="noreferrer">Open JSON response ↗</a></div>
                <span className={`status ${result ? result.ok ? "passed" : "failed" : ""}`} role="status">
                  {result ? `${result.ok ? "Passed" : "Failed"}${result.status ? ` · HTTP ${result.status}` : ""}` : running ? "Checking…" : "Ready"}
                </span>
              </div>
              {result && <details><summary>View response</summary><pre>{result.body}</pre></details>}
            </li>
          );
        })}
      </ul>
      <p className="muted">These checks read data. Customer creation, plan edits, and the Photon webhook use POST, PATCH, or DELETE and can be tested separately.</p>
    </section>
  );
}
