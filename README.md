# Bridge — HackNC 2026

AI-powered financial companion that detects spending plans discussed in
iMessage, forecasts their impact on the user's near-term finances, and
alerts them privately through Nova before they commit.

This repo is mostly a **scaffold**, with shared forecast/risk calculations
and Nessie client, adapters, and customer/account/overview route handlers
implemented. The full Next.js app and Supabase integration remain unfinished.

## Structure

- `apps/web` — Next.js + TypeScript + Tailwind web app (landing, auth,
  onboarding, dashboard, API routes).
- `apps/photon-agent` — persistent Node.js worker running the Photon
  Spectrum SDK iMessage agent for Nova.
- `packages/shared` — deterministic forecast engine, risk scoring, and
  shared domain types used by both apps.
- `supabase/` — Postgres schema migrations and seed data.

## Stack

Next.js, React, TypeScript, Tailwind CSS, shadcn/ui, Recharts, Supabase
(Auth + Postgres), Google Gemini API, Capital One Nessie API, Photon
Spectrum SDK, deployed on Vercel (web) + a persistent Node service
(Photon agent).

## Getting started

```bash
npm install
```

Copy `.env.example` to `.env.local` in `apps/web` and `.env` in
`apps/photon-agent`, filling in credentials. Where credentials are
missing, mock adapters (`USE_MOCK_NESSIE`, `USE_MOCK_GEMINI`) let
development continue without pretending mock data is real.

## Testing Nessie routes

From the repository root, run:

```bash
npm run test:nessie
```

This type-checks and runs customer creation, account creation/balance lookup,
overview, and adapter tests without starting Next.js. Tests use mock data and
fake HTTP responses; they do not need API credentials or contact Nessie.

Implemented routes:

- `POST /api/nessie/customer` — body: `first_name`, `last_name`; API mode also
  requires an `address` object. Returns `customerId`, `customer`, `dataSource`.
- `POST /api/nessie/account` — body: `customerId`, `type` (`Checking` or
  `Savings`), `nickname`, `balance`. Returns `accountId`, `account`, `dataSource`.
- `GET /api/nessie/account?accountId=...` — account details and current balance.
- `GET /api/nessie/overview?accountId=...` — account, customer, purchases, bills,
  balance, currency, source, and fetch timestamp.

These are demo routes without authentication. Supabase integration examples
are commented out until its client and database schema are implemented.
Callers keep returned IDs. Created mock accounts are kept in server memory
and disappear when that process restarts; other mock IDs use the $500 demo
checking fixture. API mode requires `USE_MOCK_NESSIE=false`, `NESSIE_API_KEY`,
and an HTTPS `NESSIE_BASE_URL`. The Next.js dependencies and startup scripts
must be configured before testing these URLs through a running app.

## Forecast route

`GET /api/forecast?accountId=demo&range=7&startDate=2026-10-10&safetyBuffer=100`
returns a baseline forecast using the selected account and unpaid Nessie bills.
Range accepts 7, 14, or 30 calendar days (default 30); safety buffer defaults
to 100. The default start date is today in UTC; supply a local calendar date
explicitly when needed. The fetched balance is used as the opening balance.

Use `POST /api/forecast` to include settings and events without Supabase:

```json
{
  "accountId": "demo",
  "range": 7,
  "startDate": "2026-10-10",
  "safetyBuffer": 100,
  "incomeEvents": [],
  "recurringExpenses": [],
  "plannedPurchases": [
    {
      "id": "trip",
      "name": "Weekend trip",
      "amount": 500,
      "expectedDate": "2026-10-16",
      "status": "tentative"
    }
  ]
}
```

All event amounts must use the account's currency. Caller-provided events
default to `amountIsEstimated: true`; set it explicitly to false for known
amounts. Event arrays default to empty. Optional `planIds` selects among the
supplied purchases; omitted means all, and an empty array means none.
GET does not resolve stored plans yet. Do not include Nessie recurring bills
again in `recurringExpenses`.

The response includes `baseline`, `postPurchase`, `balanceDelta`,
`balanceDeltaRelativeToSafetyBuffer`, `riskScore`, period, account ID, and data
source. Test the route and engine without API access using:

```bash
npm run test:forecast
```

## Photon client

`apps/photon-agent/src/photon/client.ts` uses `spectrum-ts` with its iMessage
provider. `PHOTON_PROJECT_ID` is the Spectrum Cloud project ID and
`PHOTON_API_KEY` holds that project's secret (not a per-line token).

Call `getPhotonClient(loadConfig())` at worker startup to share one client.
Consume `client.messages` as `[space, message]` pairs; only inbound iMessage
events are yielded. `client.sendText(space, text)` sends to an existing
conversation, and `client.reply(message, text)` replies to an inbound message.
The handler layer still needs to enforce pairing and conversation consent.
Call `stopPhotonClient()` during shutdown. Importing the module alone does not
connect, send messages, or install signal handlers. Worker entry-point wiring
and automatic reconnect remain separate work.

Run config, logger, and client tests without contacting Photon:

```bash
npm run test:agent
npm run typecheck --workspace @hacknc26/photon-agent
```

The agent uses `skipLibCheck` for the SDK's bundled declaration errors;
strict checks still apply to the agent's source.

The agent's `services/bridgeApiClient.ts` exposes
`createBridgeApiClient(loadConfig())`, with `verifyPairingCode(code)` and
`forwardMessage(event)`. Requests use `Authorization: Bearer` with
`PHOTON_AGENT_SHARED_SECRET`, a 10-second default timeout, response validation,
and no automatic retries. Both worker and web app must use the same secret.
Only operational metadata is logged; request bodies and pairing codes are not.

Pairing verification uses `PATCH /api/pairing` with `{ code }`, matching the
existing route. Message forwarding uses `POST /api/photon/webhook` with
`messageId`, `userId`, `senderId`, `conversationId`, `isGroup`, and `text`.
The response contract is `{ replyText: string | null, planId?: string }`;
null means no reply. These contracts are shared in
`packages/shared/src/types/photon.ts`. Pairing and conversation consent must be
checked by the handler before forwarding a message.

Live forwarding still requires implementation of the backend webhook handler.
The existing pairing route also needs server-side shared-secret verification;
sending the header alone does not add that enforcement. Client tests run
offline as part of `npm run test:agent`.

`services/pairing.ts` provides `createPairingService(bridge)` and
`extractPairingCode(text)`. The service's `handleMessage()` accepts an inbound
message's `senderId`, `conversationId`, `isGroup`, and `text`. It recognizes a
whole six-digit message or `pair 123456`, verifies it through the Bridge API,
and links the verified sender in the identity map. Group attempts, missing
senders, invalid/expired codes, conflicts, and backend failures return explicit
outcomes. Pairing does not enable conversation monitoring. The caller sends
the returned `replyText`; ordinary messages return `{ handled: false }`.

Concurrent duplicate attempts share verification; a different code from the
same sender returns busy. The initiating attempt's cancellation applies to
shared verification. Backend failures advise generating a fresh code because
the previous request may already have consumed it. No raw codes are logged or
persisted. Pairing is not yet wired into the worker's message handler.
