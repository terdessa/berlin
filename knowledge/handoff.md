# Handoff

Read `docs/agent-context.md` first, then `docs/person-3-voice-error-logging.md`.

## Current direction

Voice-first retail security copilot. Primary track: telli + ai-coustics. Fallback: Wildcard.

## Pipeline

AI agent continuously watches all camera feeds. On a review-worthy event it flags the camera, speaks to the guard's earpiece, listens for a spoken response (separate mic device, not cameras), enhances audio with ai-coustics, interprets the command, and opens video / routes action / creates an error report.

## UI (Person 1)

- Repo: `ui/` in this repo
- Stack: Vite + React + TS + Tailwind + shadcn/ui + Bun
- Camera grid → alert video panel → right-side log panel (slides in on alert)
- Review record is **text-only chat history** — no audio playback in UI
- Demo toggle on CAM-05 runs a scripted mock scenario end-to-end

## Voice service (Person 3)

- `apps/voice/` — Python, LiveKit + ai-coustics plugin, OpenAI STT/TTS
- LiveKit cloud: `wss://berlin-vc00ggsm.livekit.cloud`
- Room: `sentinel-live`
- ai-coustics: QUAIL_L via `RoomInputOptions(noise_cancellation=...)`
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

## Immediate next step

Connect live agent voice output to the UI's LiveKit room so the conversation appears in the review log in real time.
