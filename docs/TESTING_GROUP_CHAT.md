# Testing the group chat bug

We've seen private iMessage chats work end-to-end with Nova, but a 3-person
group chat produces total silence: no reply, and no log output at all, even
on the lines that should log every ignored message.

`main` now includes a temporary debug log in
`apps/photon-agent/src/photon/client.ts` that logs every raw incoming
message (platform/direction/space id) before any filtering happens, so we
can see whether group messages are even reaching our code at all.

## Steps

1. `git pull origin main` (or clone fresh).
2. `npm install` from the repo root.
3. Create `apps/web/.env.local` (copy from `apps/web/.env.example`) with
   real or mock values as needed.
4. Create `apps/photon-agent/.env` (copy from
   `apps/photon-agent/.env.example`) with:
   - `PHOTON_PROJECT_ID` / `PHOTON_API_KEY` — real Photon Spectrum
     credentials (no mock mode exists for this one).
   - `BRIDGE_API_BASE_URL` — wherever `apps/web` is running, e.g.
     `http://localhost:3000`.
   - `PHOTON_AGENT_SHARED_SECRET` — must match the same value in
     `apps/web/.env.local` exactly.
   - `LOG_LEVEL=debug` — required to see the diagnostic log line below.
5. Start both:
   ```bash
   npm run dev --workspace @hacknc26/web
   npm run dev --workspace @hacknc26/photon-agent
   ```
6. Text the group chat (the one with 3 people + the Photon agent number).
7. Check the worker's terminal for a line with `"event":"photon.raw_message"`.
   - If it appears: note the `eventType` field's `platform=...
     direction=... spaceId=...` values and report them back.
   - If nothing appears at all: the message isn't reaching our process —
     points at a Photon/SDK-side delivery issue, not our code.

Remove the temporary debug log in `client.ts` once this is resolved.
