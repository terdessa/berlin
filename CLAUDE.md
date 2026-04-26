# CLAUDE.md

Guidance for Claude working in this repository.

## Source Of Truth

Use these docs only:

- `docs/agent-context.md` — canonical product and architecture context
- `docs/demo-plan.md` — demo flow
- `docs/sentinel-audio-intelligence-metric.md` — SAIS and audio evidence

Do not add timestamped planning notes or resurrect deleted `knowledge/`, role/person, or scratch docs.

## Project

**Sentinel** is a voice-first retail security copilot using LiveKit, Gradium, ai-coustics, and Gemini.

It watches local camera feeds, sends a 5-frame burst of CAM-03 to Gemini at ~5 fps, speaks review alerts to a guard through the phone-based walkie-talkie page, hears the guard through the same phone, enhances noisy speech with ai-coustics, interprets commands, and writes structured interaction records.

One-line pitch:

> Sentinel helps retail security teams hear, review, and respond to camera events hands-free, even in noisy supermarkets.

## Current Architecture

- Dashboard route: `/` — laptop. Owns the camera grid and the review log. **No microphone, no walkie-talkie button.** Subscribes to `sentinel.voice` data packets and publishes `sentinel.visual-alert`. Joins LiveKit as identity `sentinel-dashboard`.
- Walkie-talkie route: `/voice` — phone. Press-and-hold mic button, plays the agent's TTS through the phone speaker. Joins LiveKit as identity `sentinel-guard-mic`.
- Metrics route: `/metrics`
- LiveKit is **voice/data only**. Do not reintroduce LiveKit video streaming.
- CAM-01, CAM-02, CAM-04, CAM-05, CAM-06, CAM-07, and CAM-08 loop local clips from `ui/public/cams`.
- CAM-03 opens the selected local browser camera (laptop webcam or Continuity Camera).
- Gemini analyzes **only CAM-03** from the dashboard. Each analysis call sends an ordered burst of 5 JPEG frames captured at 200 ms intervals. The detector mode is `object-hold`: it returns `HOLD` when a person is visibly holding a picked-up object, otherwise `NONE`.
- A `HOLD` reply triggers a single `sentinel.visual-alert` data packet per page-load (refresh the dashboard to re-arm).
- The Python voice agent publishes `sentinel.voice` packets for dashboard review-log updates.
- One LiveKit connection per page tab — `ui/src/lib/use-sentinel-room.ts` is the single hook for both modes via the `withMic` option (false on dashboard, true on `/voice`).

## Environment

Use a single root `.env`. There is no `ui/.env`.

The UI dev server loads the parent `.env` through `ui/vite.config.ts`.

Required runtime keys:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`
- `GEMINI_API_KEY`
- `GRADIUM_API_KEY`

The ai-coustics SDK key is **not** a local env var. Configure it in the LiveKit Cloud project's ai-coustics integration; LiveKit Cloud forwards a short-lived credential to the `livekit-plugins-ai-coustics` plugin at runtime.

Optional tuning knobs (env-overridable):

- `SENTINEL_UTTERANCE_SILENCE_MS` (default `350`) — trailing-silence window before flushing an utterance.
- `SENTINEL_VAD_THRESHOLD` (default `0.6`), `SENTINEL_VAD_BUCKET` (default `1`) — Gradium STT VAD aggressiveness.
- `LIVEKIT_MIC_IDENTITY` (default `sentinel-guard-mic`) — must match the identity used by `/voice`.

Never commit real secrets.

## UI Stack

- Vite + React + TypeScript
- Tailwind CSS
- TanStack Start
- Bun or npm
- Cloudflare Workers deploy target

Run UI commands from `ui/`:

```bash
bun install
bun run dev
bun run lint
bun run build
```

The dev server runs over HTTPS so phones and Continuity Camera workflows can use `getUserMedia`. Vite prints both the `localhost` URL (laptop dashboard) and the LAN URL (phone `/voice` page) at startup.

## Voice Service

Run from repo root or `apps/voice` as documented in `apps/voice/README.md`.

```bash
cd apps/voice
source .venv/bin/activate    # or .venv\Scripts\activate on Windows
python -m src.agent dev
```

The worker self-dispatches into `sentinel-live` on startup with `agent_name="sentinel"`, ensuring the room exists first via `RoomService.create_room`. Use
`python -m src.dispatch_agent --status` to inspect the room, or
`python -m src.dispatch_agent --reset` to clear stale dispatches.

The default room is `sentinel-live`; the phone `/voice` page publishes the guard mic on identity `sentinel-guard-mic` (override with `LIVEKIT_MIC_IDENTITY`).

## Safety Language

Sentinel is a human-review tool, not an accusation or enforcement system.

The agent describes observable behavior and answers from the camera frame directly. Phrases like "requires review" / "human review recommended" are reserved for the single case where the guard asks something the camera can't answer (security policy, identity, judgement call).

Use:

- "item appears to move"
- "voice command unclear"
- "human review recommended" — only when answer requires human judgement

Avoid:

- "thief"
- "criminal"
- "stealing"
- "guilty"
- identity claims
- intent claims
- reflexive "human review recommended" / "requires review" on every reply

No facial recognition, identity tracking, automated accusation, detention, punishment, or enforcement.

## File Layout

- `docs/` — only active project markdown
- `ui/src/routes/index.tsx` — dashboard `/`
- `ui/src/routes/voice.tsx` — phone walkie-talkie `/voice`
- `ui/src/routes/metrics.tsx` — submission metrics `/metrics`
- `ui/src/components/sentinel/` — dashboard UI components
- `ui/src/lib/camera-config.ts` — camera labels, order, clip paths
- `ui/src/lib/gemini-camera-analysis.ts` — Gemini server function (modes incl. `object-hold`)
- `ui/src/lib/livekit-token.ts` — LiveKit token server function
- `ui/src/lib/use-sentinel-room.ts` — single LiveKit connection hook (`withMic` option)
- `apps/voice/src/` — Python voice worker, interpretation, logging, metrics
- `apps/voice/tools/` — utility scripts
- `apps/voice/submission/` — generated corpus/results

## Validation

Before handing off UI changes, run:

```bash
cd ui
npm run lint
npm run build
```

For Python voice changes, run focused compile/tests, for example:

```bash
python -m py_compile apps/voice/src/agent.py apps/voice/src/interpret.py
```

The old shadcn scaffold has been removed; keep new UI code local to the Sentinel components unless a shared primitive is clearly needed.
