# Work Division — 3 People

Detailed to-do list per person, in build order, with exact file paths. Goal: minimize merge conflicts by keeping each person on a mostly-disjoint set of files.

## Person 1 — Frontend shell, landing page, onboarding

1. `apps/web/tailwind.config.ts` + `apps/web/src/app/globals.css` — set up the Frutiger Aero color palette, rounded corners, shadows first; everything else visual depends on this.
2. `apps/web/src/components/nova/NovaAvatar.tsx` and `NovaBubble.tsx` — build the Nova mascot component early since it's reused everywhere.
3. `apps/web/src/components/landing/Hero.tsx`, `ProblemSection.tsx`, `HowItWorks.tsx`, `ProductPreview.tsx`, `PrivacySection.tsx`, `CTASection.tsx` — the six landing sections.
4. `apps/web/src/app/(marketing)/page.tsx` — wire those sections together into the actual landing page.
5. `apps/web/src/app/login/page.tsx` — login screen UI (calls into Person 3's auth hook once it exists, but the UI itself can be built against a stub).
6. `apps/web/src/components/onboarding/StepIndicator.tsx` — progress bar for the 5-step flow.
7. `apps/web/src/app/onboarding/layout.tsx` — wraps all onboarding steps with the step indicator.
8. `apps/web/src/app/onboarding/welcome/page.tsx`, `financial-setup/page.tsx`, `safety-preferences/page.tsx`, `connect-imessage/page.tsx`, `privacy-consent/page.tsx` — the 5 step screens, in that order.
9. `apps/web/src/components/ui/` — shadcn components as you need them (button, card, input, etc.) — pull these in as the above steps need them rather than all upfront.

## Person 2 — Financial engine & dashboard

1. `packages/shared/src/forecast/types.ts` — define the shapes first (ForecastInput/Result, RiskScoreResult).
2. `packages/shared/src/forecast/engine.ts` — the balance projection math (`B(t)` formula).
3. `packages/shared/src/forecast/risk.ts` — the risk score formula, built on top of engine.ts output.
4. `packages/shared/src/types/plan.ts` and `packages/shared/src/types/nessie.ts` — domain types for plans and bank data.
5. `supabase/migrations/0001_init.sql` and `supabase/seed.sql` — DB schema + demo data, needed before any API route can really be tested.
6. `apps/web/src/lib/nessie/types.ts`, `adapters.ts`, `client.ts` — Nessie client + mock fallback, in that order.
7. `apps/web/src/app/api/nessie/customer/route.ts`, `account/route.ts`, `overview/route.ts` — API routes wrapping the client above.
8. `apps/web/src/app/api/forecast/route.ts` — wraps the forecast engine for the frontend to call.
9. `apps/web/src/app/api/plans/route.ts` and `plans/[id]/route.ts` — CRUD for spending plans.
10. `apps/web/src/hooks/useForecast.ts` and `usePlans.ts` — client hooks consuming the above routes.
11. `apps/web/src/components/dashboard/SummaryCard.tsx`, `ForecastChart.tsx`, `UpcomingBillsWidget.tsx`, `PlanCard.tsx`, `InsightsFeed.tsx` — dashboard widgets, each independent.
12. `apps/web/src/app/dashboard/layout.tsx` — sidebar/nav shell.
13. `apps/web/src/app/dashboard/page.tsx`, `plans/page.tsx`, `forecast/page.tsx`, `transactions/page.tsx`, `action-center/page.tsx`, `settings/page.tsx` — assembling pages from the widgets above.

## Person 3 — Messaging & AI pipeline

1. `packages/shared/src/types/user.ts` — define `MessagingIdentity` and `FinancialPreferences` types first.
2. `apps/web/src/lib/supabase/client.ts`, `server.ts`, `middleware.ts` — Supabase auth plumbing.
3. `apps/web/src/middleware.ts` — route protection using the above.
4. `apps/web/src/hooks/useAuth.ts` — client-side auth hook.
5. `apps/web/src/app/auth/callback/route.ts` — OAuth callback handler.
6. `apps/web/src/lib/gemini/client.ts`, `prompts.ts`, `intentDetection.ts` — Gemini wrapper, in that order.
7. `apps/web/src/app/api/gemini/detect-intent/route.ts`, `explain/route.ts` — API routes wrapping Gemini.
8. `apps/web/src/app/api/pairing/route.ts` — pairing code generation/verification for the iMessage-connect step.
9. `apps/photon-agent/src/config.ts` and `logger.ts` — basic plumbing for the worker.
10. `apps/photon-agent/src/photon/client.ts` — Photon Spectrum SDK init.
11. `apps/photon-agent/src/photon/identityMap.ts` — Photon-identity-to-user mapping.
12. `apps/photon-agent/src/services/bridgeApiClient.ts` and `pairing.ts` — calling back into the web app's API.
13. `apps/photon-agent/src/photon/handlers.ts` — the incoming-message router, tying everything in this list together.
14. `apps/photon-agent/src/index.ts` — entry point that boots it all.
15. `apps/web/src/app/api/photon/webhook/route.ts` — the backend endpoint the worker calls into.

## Files with real overlap/merge-conflict risk

- **`packages/shared/src/types/index.ts`** — the barrel file every type gets re-exported from. Person 2 and Person 3 will both add lines here. Low-risk if you each just append your own export line and don't reorder others' lines, but announce it when you touch it.
- **`packages/shared/src/index.ts`** — same story, package-level barrel.
- **`apps/web/package.json`** — whoever adds a new npm dependency first should push immediately; if two people add different deps in the same sitting without pulling, you'll get a conflict in the dependencies block. Rule: `git pull` right before adding a dependency, push right after.
- **`apps/web/src/types/index.ts`** — mostly Person 1/UI-only types, but if anyone else adds a stray type here instead of to `packages/shared`, you'll collide. Agree up front: domain types go in `packages/shared`, UI-only prop types go here.
- **`.env.example` files** (`apps/web/.env.example`, `apps/photon-agent/.env.example`) — everyone will eventually add a key they need. Minor, line-level conflicts only, easy to resolve.
- **Root `package.json` and `README.md`** — anyone editing workspace scripts or the setup instructions. Keep edits here small and pull before editing.

Everything else (actual pages, components, API route bodies) is one-person-per-file, so conflicts there should be essentially zero as long as nobody strays outside their list.
