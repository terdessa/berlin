# Active Context

Sentinel is a **voice-first retail security copilot** for the **telli + ai-coustics** track.

## Pipeline

1. AI agent continuously analyzes all CCTV/live camera feeds.
2. When review-worthy behavior appears, the dashboard flags the camera and Sentinel speaks an alert to the guard's earpiece.
3. Guard responds by voice through a separate earpiece/mic device (not via the cameras).
4. ai-coustics enhances the guard audio (LiveKit plugin, QUAIL_L model).
5. Voice layer interprets the command.
6. Sentinel opens the relevant evidence video, routes the action, or creates an error report.
7. Two-way voice channel stays open during the review.

## UI (Person 1)

The dashboard is at `ui/`. Stack: Vite + React + TS + Tailwind + shadcn/ui + TanStack Start (SSR) + Bun, Cloudflare deploy.

- No top bar. Ambient "Sentinel is watching" corner pill is the only persistent status.
- Camera grid (6 tiles, 3×2): tiles show **real live video** from connected publisher devices when LiveKit is configured. Devices fill tiles in join order (first device → CAM-01, second → CAM-02, etc.). Remaining tiles keep placeholder animation.
- Alert video panel below the grid, ~50% width.
- Right-side log panel slides in only on alert.
- Review record uses **text-only chat history** between Sentinel and Guard — no audio waveforms.
- Demo toggle simulates an alert on CAM-05/CAM-08 with a hardcoded mock conversation.
- Dev server runs on **HTTPS** (self-signed cert) and prints LAN + localhost URLs for `/`, `/video`, `/audio` at startup.
- Live voice events from the Python agent now feed the review log in real time through LiveKit data packets on topic `sentinel.voice`.

### Live utility pages

- `/video` — publishes the device camera to `sentinel-live`; includes a camera-lens switcher (enumerate all video inputs after permission, hot-swap via `replaceTrack`). Capture: 1280×720 @ 30 fps, 2.5 Mbps, no simulcast.
- `/audio` — publishes the device mic to `sentinel-live` as `sentinel-guard-mic` by default, matching the voice agent's `LIVEKIT_MIC_IDENTITY`.
- Both pages subscribe to other publishers in the same room and show a real-time WebRTC stats panel (kbps, fps, resolution, codec, `qualityLimitationReason`).

### Key library files added

| File | Purpose |
|------|---------|
| `src/lib/livekit-token.ts` | Server function minting LiveKit JWTs; supports `viewerOnly` flag |
| `src/lib/use-livekit-feeds.ts` | Viewer-only subscriber hook; returns ordered `LiveFeed[]` for the dashboard grid |
| `src/lib/use-livekit-stats.ts` | Polls `RTCPeerConnection.getStats()` for the stats panel |
| `src/lib/live-stats-panel.tsx` | Stats panel UI component |
| `src/lib/live-page-skeleton.tsx` | SSR-safe skeleton preventing hydration mismatches on live pages |

## Voice service (Person 3)

Running at `apps/voice/`. Python + LiveKit + ai-coustics plugin.

- Agent connected to LiveKit cloud: `wss://berlin-vc00ggsm.livekit.cloud`
- ai-coustics QUAIL_L wired via `RoomInputOptions(noise_cancellation=...)`
- OpenAI STT/TTS as voice runtime (telli-swappable in two lines), with Silero VAD wrapping non-streaming STT
- Agent listens to the `sentinel-guard-mic` participant by default and emits dashboard data events on `sentinel.voice`
- Command interpreter: 6 commands, ACTION_THRESHOLD=0.7, failure-mode classification
- Every interaction logged to `apps/voice/submission/interactions.json`

## Track differentiator

Every voice interaction → structured JSON record + raw/enhanced audio files.
Failure records include NISQA scores, conversation history, visual context, failure mode classification, and natural-language explanation. The corpus is a data product ai-coustics can take home.

Current audio metric: SAIS, defined as `(correct actions + safe recoveries) / total commands`. NISQA/DNSMOS and WER are supporting metrics. Context-target mismatches should trigger clarification and count as safe recovery, not failure. Current spec lives in `docs/sentinel-audio-intelligence-metric.md`.

Audio benchmark assets now live under `apps/voice/dataset/` with `manifest.json` and `audio/clean` + `audio/noisy` WAV folders. Results are written to `apps/voice/submission/audio_dataset_results.json`.

## Side challenge focus

- Entire: push at least one error record as a review task
- Aikido: connect repo and screenshot if setup is quick

## Safety

- Action threshold: 0.7 command confidence. Below → clarification, not action.
- Max 3 clarification attempts → error record.
- All language non-accusatory.

## Next tasks

- Wire real `visual_event` objects from Person 2 (Gemini video analysis) into the dashboard alert flow.
- Add explicit context-target mismatch examples to the audio dataset so Safe Recovery Rate is exercised by real clips, not only the scripted comparison data.
- Consider self-hosting LiveKit on the laptop for local-network demos to avoid mobile-upload bottleneck when using a phone hotspot.
- Replace OpenAI STT/TTS with telli runtime when the booth integration is ready.
