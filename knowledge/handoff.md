# Handoff

Read `docs/agent-context.md` first, then `docs/person-3-voice-error-logging.md`.

## Current direction

Voice-first retail security copilot. Primary track: telli + ai-coustics. Fallback: Wildcard.

## Pipeline

AI agent continuously watches all camera feeds. On a review-worthy event it flags the camera, speaks to the guard's earpiece, listens for a spoken response (separate mic device, not cameras), enhances audio with ai-coustics, interprets the command, and opens video / routes action / creates an error report.

## UI (Person 1)

- Repo: `ui/` in this repo
- Stack: Vite + React + TS + Tailwind + shadcn/ui + TanStack Start (SSR) + Bun
- Dev server runs on **HTTPS** (self-signed cert auto-generated) — required for `getUserMedia` on non-localhost devices
- Camera grid (6 tiles, 3×2): **live video from connected devices** fills tiles in join order via `useLivekitFeeds`; remaining tiles show placeholder animation
- Alert video panel → right-side log panel (slides in on alert)
- Review record is **text-only chat history** — no audio playback in UI
- Demo toggle on CAM-05/CAM-08 runs a scripted mock scenario end-to-end
- Live voice agent turns flow into the review log via LiveKit data packets on topic `sentinel.voice`.

### Live pages

| Route | Role |
|-------|------|
| `/video` | Camera publisher — lens switcher, 720p30, LiveKit publish + subscribe, real-time stats panel |
| `/audio` | Mic publisher — default identity `sentinel-guard-mic`, LiveKit publish + subscribe, real-time stats panel |

Both are direct-link-only (not linked from dashboard). The server prints LAN + localhost URLs for all three routes at startup.

### LiveKit token server function

`src/lib/livekit-token.ts` — accepts `{ room, identity, viewerOnly? }`. Dashboard gets `viewerOnly: true` (subscribe only). Publishers get full access. Reads `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` from `ui/.env` (gitignored; see `.env.example`).

## Voice service (Person 3)

- `apps/voice/` — Python, LiveKit + ai-coustics plugin, OpenAI STT/TTS
- LiveKit cloud: `wss://berlin-vc00ggsm.livekit.cloud`
- Room: `sentinel-live`
- ai-coustics: QUAIL_L via `RoomInputOptions(noise_cancellation=...)`
- Mic participant identity: `sentinel-guard-mic` by default; override only when `LIVEKIT_MIC_IDENTITY` and `/audio?identity=...` match
- OpenAI STT/TTS plus Silero VAD; LiveKit `user_input_transcribed` events are converted into command interpretation and `sentinel.voice` dashboard packets
- Every interaction → `apps/voice/submission/interactions.json`

## Track differentiator

Rich error corpus with NISQA before/after, failure mode classification, full conversation + visual context. Data product for ai-coustics.

## Demo must show

- camera event flagged on a tile
- earpiece alert spoken to guard
- guard command spoken in noisy conditions
- ai-coustics enhancement visible (confidence raw vs enhanced)
- command interpretation
- video opened or error report created
- text conversation history in the log panel

## Language

Keep all alert language non-accusatory. Show confidence, not verdicts.

## Side challenges

- Entire first (push one error record as a review task)
- Aikido if setup is quick

## Immediate next steps

1. **Wire real visual events** — connect Person 2 (Gemini video analysis) `visual_event` output to the dashboard alert flow instead of the mock scenario.
2. **Local LiveKit option** — for demos on a phone hotspot, running `livekit-server --dev` on the laptop keeps all traffic on the LAN and avoids mobile-upload saturation.
3. **telli runtime swap** — replace the OpenAI STT/TTS placeholder when telli credentials/API shape are confirmed.
