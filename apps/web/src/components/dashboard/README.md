# Figma dashboard integration

The dashboard design comes from `figma-export/Create Tabbed Navigation`.
The original Vite export stays intact as a reference; the app remains Next.js.

- `Design.tsx`: reusable exported icons, Nova images, buttons, page headings, and metric cards.
- `DashboardShell.tsx`: Next.js navigation, shared account/plan/forecast state, and browser preferences.
- `Screens.tsx`: Overview, Plans, Forecast, Transactions, Action Center, and Settings.
- `dashboard.css`: exported styles scoped to `.bridge-dashboard`, plus integration adjustments.
- Nova artwork is served from `apps/web/public/assets/nova/`.

`/` opens `/dashboard`; the original GET-only API check panel is at `/development`.
Existing login, onboarding, Nova/iMessage, and API routes remain available.

The export's fictional Maya account, balances, payday, transactions, and plans are
replaced by `/api/nessie/overview`, `usePlans`, and `useForecast`. Forecasts include
active plans in the selected account currency. Bills enter through the existing
forecast adapter; purchase history is never deducted again. No fictional income
or sample plans are inserted. Data failures display errors rather than sample data.

Settings persist the display name, workspace, account ID, safety buffer, and range
in browser localStorage. The default account ID is `demo`; configure an actual
Nessie simulation account ID in Settings when mock mode is disabled. This does not
add authentication or alter the existing single-user, in-memory plan storage.
No new runtime dependencies or Tailwind/Vite setup are needed. The font uses the
DM Sans family when available, with Arial as a local fallback.

The dashboard polls plans every three seconds while visible and refreshes when
focus returns. Background reads retain the forecast and existing plans. A header
Refresh button also reloads account, plan, and forecast data. The single-user
demo plan store is shared across route module evaluations within one server
process, including hot reloads; restarting or separate processes still reset or
isolate its data. Photon worker logs `message.received` and `message.ignored`
with routing metadata and ignore reasons, without message text or pairing codes.

Verification: `npm run build --workspace @hacknc26/web`, `npm run test:hooks`,
and `npm run test:nessie`. An isolated React/jsdom interaction smoke check also
exercised plan creation/dismissal, cancel without saving, forecast range and plan
payloads, saved preferences, and rendering of all six screens.

Explore alternatives now opens `PlanAlternatives.tsx` inline from My Plans,
Overview, or the Forecast plan selector. Its POST request to
`/api/plans/:id/alternatives` loads the selected account and stored plans on the
server. Gemini proposes two or three budget/date/cancellation options; the
forecast engine calculates each option's effect alongside all other active
plans. Generation leaves plans unchanged. Only explicit Apply or Dismiss saves
through the existing PATCH API and refreshes the dashboard.

Costs are estimated spending targets, not verified prices. Alternatives stay
within the selected forecast period, assume no unconfigured income, and show
when an option still leaves a shortfall or safety-buffer gap. Outside-period
plans show an actionable error. Explicit Gemini mock mode returns labeled demo
suggestions; live provider failures show errors with a retry control.

`npm run test:dashboard` checks generation, explicit application, retry, and stale
request handling. `npm run test:plans` also covers the alternatives endpoint and
server calculations. A live preview against the demo account was verified with
Gemini; the saved plan was unchanged.
