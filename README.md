# Bridge — HackNC 2026

AI-powered financial companion that detects spending plans discussed in
iMessage, forecasts their impact on the user's near-term finances, and
alerts them privately through Nova before they commit.

This repo is currently a **scaffold**: every file is a comment describing
what it will contain and the features it's responsible for. No
implementation code has been written yet.

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
