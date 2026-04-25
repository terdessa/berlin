# Handoff

Read `docs/agent-context.md` first.

## Current direction

- voice-first retail security copilot
- primary track: telli + ai-coustics
- fallback: Wildcard
- side challenge targets: Gradium and Entire first, Aikido if quick

## Pipeline

AI agent continuously watches all camera feeds. On a review-worthy event it flags the camera, speaks to the guard's earpiece, listens for a spoken response (via a separate mic device, not the cameras), enhances it with ai-coustics, interprets the command, and opens video / routes action / creates an error report.

## UI

- Repo: https://github.com/terdessa/sentinel-watch (cloned locally at `ui/`)
- Stack: Vite + React + TS + Tailwind + shadcn/ui + Bun
- No top bar; ambient "Sentinel is watching" pill is the only persistent status
- Camera grid on top, alert video panel below, right-side log slides in only on alert
- Review record is a **text-only chat history** between Sentinel and Guard — no audio playback in the UI

## Demo must show

- camera event flagged on a tile
- earpiece alert spoken to guard
- guard command spoken in noisy conditions
- ai-coustics enhancement
- command interpretation
- video opened or error report created
- text conversation history of the exchange in the log panel

## Language

Keep all alert language non-accusatory. Show confidence, not verdicts.
