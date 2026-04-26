# CLAUDE.md

Guidance for Claude working in this repository.

## Project state

**Sentinel** was a voice-first retail security copilot built around LiveKit,
Gradium, ai-coustics, and Gemini. The backend has been **removed pending a
clean rewrite**.

What remains is the dashboard UI: a camera wall (looped local clips for
CAM-01/02/04–08, a passive webcam preview on CAM-03), the review-log
panel sitting in its idle state, and the `/metrics` page reading the
bundled `audio-metrics-generated.json`. There is no agent, no microphone,
no STT/TTS, no CV analysis.

When you add the next backend, decide first whether the existing
camera/review-log UI is the right shell or whether it should be redesigned.
Don't reintroduce the deleted helpers (`use-sentinel-room.ts`,
`use-sentinel-voice-events.ts`, `livekit-token.ts`, `gemini-camera-analysis.ts`,
`publish-visual-alert.ts`) — start fresh.

## Source of truth for design intent

- `docs/agent-context.md` — historical product/architecture context (still
  describes the deleted voice path; treat as background).
- `docs/sentinel-audio-intelligence-metric.md` — SAIS definition; useful when
  the new backend wants to reproduce the metric.
- `docs/demo-plan.md` — historical demo flow.

## Layout (after backend removal)

- `ui/` — Vite + React + TypeScript + TanStack Start dashboard.
  - `ui/src/components/sentinel/` — dashboard UI components.
  - `ui/src/lib/camera-config.ts` — camera labels, order, clip paths.
  - `ui/src/lib/audio-metrics-data.ts` + `audio-metrics-generated.json` —
    static metrics rendered by `/metrics`.
  - `ui/src/lib/sentinel-data.ts` — UI types (kept stable for the rewrite).
- `cams/` — looped MP4 clips served from `ui/public/cams`.
- `docs/` — design docs (read-only reference).

## Validation

Before handing off UI changes:

```bash
cd ui
npm run lint
npm run build
```
