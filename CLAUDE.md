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

It watches local camera feeds, sends only CAM-03 frames to Gemini, speaks review alerts to a guard through the LiveKit walkie-talkie path, hears the guard through the in-dashboard hold-to-talk button, enhances noisy speech with ai-coustics, interprets commands, and writes structured interaction records.

One-line pitch:

> Sentinel helps retail security teams hear, review, and respond to camera events hands-free, even in noisy supermarkets.

## Current Architecture

- Dashboard route: `/` — owns cameras AND the hold-to-talk mic.
- Metrics route: `/metrics`
- LiveKit is **voice/data only**. Do not reintroduce LiveKit video streaming.
- The dashboard opens the laptop microphone but only unmutes the LiveKit track while the user is holding the in-dashboard "hold to talk" button.
- CAM-01, CAM-02, CAM-04, CAM-05, CAM-06, CAM-07, and CAM-08 loop local clips from `ui/public/cams`.
- CAM-03 opens the selected local browser camera, including iPhone Continuity Camera when macOS exposes it.
- Gemini analyzes only CAM-03 from the dashboard.
- Gemini visual alerts publish `sentinel.visual-alert` data packets into the LiveKit voice room.
- The Python voice agent publishes `sentinel.voice` packets for dashboard review-log updates.
- One LiveKit connection per dashboard tab — `ui/src/lib/use-sentinel-room.ts` owns mic publish, data publish, data subscribe, and remote-TTS playback.

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

The dev server runs over HTTPS so phones and Continuity Camera workflows can use `getUserMedia`.

## Voice Service

Run from repo root or `apps/voice` as documented in `apps/voice/README.md`.

```bash
cd apps/voice
source .venv/bin/activate
python -m src.agent dev
```

The worker self-dispatches into `sentinel-live` on startup with `agent_name="sentinel"`. Use
`python -m src.dispatch_agent --status` to inspect the room, or
`python -m src.dispatch_agent --reset` to clear stale dispatches.

The default room is `sentinel-live`; the dashboard publishes the guard mic on identity `sentinel-guard-mic` (override with `LIVEKIT_MIC_IDENTITY`).

## Safety Language

Sentinel is a human-review tool, not an accusation or enforcement system.

Use:

- "requires review"
- "possible loss-prevention review"
- "observable shelf-to-pocket sequence"
- "human review recommended"
- "voice command unclear"

Avoid:

- "thief"
- "criminal"
- "stealing"
- "guilty"
- identity claims
- intent claims

No facial recognition, identity tracking, automated accusation, detention, punishment, or enforcement.

## File Layout

- `docs/` — only active project markdown
- `ui/src/components/sentinel/` — dashboard UI components
- `ui/src/lib/camera-config.ts` — camera labels, order, clip paths
- `ui/src/lib/gemini-camera-analysis.ts` — Gemini server function
- `ui/src/lib/livekit-token.ts` — LiveKit token server function
- `ui/src/lib/use-sentinel-room.ts` — single dashboard LiveKit connection (mic + data + remote TTS)
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
