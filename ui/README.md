# Sentinel — UI

Front-end for **Sentinel**, a voice-first retail security copilot.

Built with Vite + React + TypeScript + Tailwind + TanStack Start (SSR).

> Sentinel is a _human-review_ tool. It surfaces review-worthy camera events; it does not accuse, identify, or enforce. Keep all UI language non-accusatory.

## Routes

| Route | Device | Description |
| --- | --- | --- |
| `/` | Laptop | Security ops dashboard. Eight camera tiles: CAM-01, 02, 04, 05, 06, 07, 08 loop local demo clips; CAM-03 is the live laptop camera analyzed by Gemini. Review log on the right shows the live conversation between guard and agent. **No microphone here.** |
| `/voice` | Phone | Press-and-hold walkie-talkie. Joins LiveKit as `sentinel-guard-mic`, publishes the phone mic to the voice agent, plays the agent's TTS reply back through the phone speaker. |
| `/metrics` | Laptop | Submission metrics dashboard for SAIS, WER, safe recovery, and dangerous-error evidence. |

All routes share the same Vite dev server (single process, single port).

## Prerequisites

- [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`)
- Git
- Node 18+ works as a fallback if you prefer `npm`

## Run locally

```bash
cd ui
bun install
bun run dev
```

The server starts on **HTTPS** with a self-signed certificate (required so phones on the LAN can use `getUserMedia`). At startup it prints both the localhost URL (for the dashboard) and the LAN URL (for the phone `/voice` page). Phones need to accept the self-signed cert warning once.

Other scripts:

```bash
bun run build       # production build
bun run preview     # serve the production build
bun run lint        # eslint
bun run format      # prettier write
```

## Credentials

The UI and Python voice worker share one credential file at the repository root:

```bash
cp ../.env.example ../.env
```

Fill in the root `.env`, then run the UI from `ui/`. The Vite dev server loads the parent `.env` automatically, so `ui/.env` is not needed.

## LiveKit

Add credentials from [cloud.livekit.io](https://cloud.livekit.io):

```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxx
LIVEKIT_API_SECRET=your-secret
```

Without credentials the dashboard and `/voice` still open locally, but voice/data packets cannot leave the browser.

The dashboard joins LiveKit as identity `sentinel-dashboard` (data only — no mic, no remote-audio playback). The phone `/voice` page joins as `sentinel-guard-mic`, publishes its mic, and plays back the agent's TTS.

## Gemini

Add a server-side Gemini key to the root `.env`:

```
GEMINI_API_KEY=your-gemini-api-key
```

The dashboard CAM-03 analyzer keeps the key on the server via `src/lib/gemini-camera-analysis.ts`. The model is pinned to **Gemini 2.5 Flash Lite**. Each analysis call sends an ordered burst of 5 JPEG frames captured at 200 ms intervals (5 fps over ~1 s), giving Gemini real motion to analyse instead of a single still.

The detector mode is `object-hold`: Gemini replies `HOLD` when a person is visibly holding a picked-up object, otherwise `NONE`. A `HOLD` reply triggers one `sentinel.visual-alert` data packet per page-load — refresh to re-arm.

## Camera analysis

LiveKit is not used for video. Demo clips live in `public/cams/` for CAM-01, CAM-02, CAM-04, CAM-05, CAM-06, CAM-07, and CAM-08. CAM-03 opens the local browser camera on the dashboard and is the only feed sent to Gemini. On macOS, an iPhone connected as Continuity Camera shows up as a regular camera input.

## Live voice log

The dashboard subscribes to the `sentinel.voice` LiveKit data topic. The Python agent in `../apps/voice` listens to the `sentinel-guard-mic` participant (the phone), transcribes guard speech, interprets commands, speaks visual alerts when CAM-03 fires, and publishes `assistant_turn`, `guard_turn`, and `interaction_record` packets. Those packets update the dashboard's review log in real time. Guard transcripts appear immediately on the dashboard while raw-vs-enhanced dual-pass STT runs in the background for the corpus.

## Project layout

```
src/
  routes/
    index.tsx                    # Dashboard /
    voice.tsx                    # Phone walkie-talkie /voice
    metrics.tsx                  # SAIS metrics dashboard /metrics
  components/sentinel/           # Dashboard UI components
  lib/
    camera-config.ts             # Dashboard camera names, ordering, demo clip paths
    livekit-token.ts             # TanStack Start server fn — mints LiveKit JWTs
    gemini-camera-analysis.ts    # TanStack Start server fn — Gemini frame analysis
    use-sentinel-room.ts         # Hook — single LiveKit connection (withMic option)
    sentinel-data.ts             # Shared types
    audio-metrics-data.ts        # Static metrics for /metrics
    audio-metrics-generated.json # Generated metrics input
vite.config.ts                   # HTTPS cert, root env loading, startup URL banner
wrangler.jsonc                   # Cloudflare Workers deploy config
```

## Push changes

```bash
git checkout -b your-feature
# ...edit files...
git add -A
git commit -m "describe the change"
git push -u origin your-feature
```

Then open a PR against `main` on GitHub.

## Deploy (Cloudflare)

```bash
bunx wrangler deploy
```

You'll need to be logged in (`bunx wrangler login`) and have access to the target Cloudflare account. The LiveKit and Gemini server functions run via the Workers Node.js compatibility layer.

## Related

- `../docs/agent-context.md` — product context
- `../docs/demo-plan.md` — demo flow
- `../docs/sentinel-audio-intelligence-metric.md` — SAIS and audio evidence
- `../apps/voice/README.md` — Python voice agent
