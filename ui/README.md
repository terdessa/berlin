# Sentinel — UI

Front-end for **Sentinel**, a voice-first retail security copilot.

Built with Vite + React + TypeScript + Tailwind + TanStack Start (SSR). Originally scaffolded in Lovable.

> Sentinel is a _human-review_ tool. It surfaces review-worthy camera events; it does not accuse, identify, or enforce. Keep all UI language non-accusatory.

## What lives here

| Route             | Description                                                                                                                                                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/`               | Security ops dashboard. Eight camera tiles: CAM-01, 02, 04, 05, 06, 07, and 08 loop local demo clips; CAM-03 is the live MacBook/Continuity Camera analyzed by Gemini.                                                               |
| `/audio`          | Direct-link walkie-talkie page. Publishes the guard microphone to LiveKit as `sentinel-guard-mic` while the talk button is held; Sentinel voice replies play back through the same room.                                             |
| `/gemini-preview` | Direct-link local camera + voice analyst. Opens the Mac/iPhone Continuity Camera and mic, sends frames/audio through the server-side Gemini bridge, and publishes visual alerts as LiveKit data packets for the walkie-talkie agent. |
| `/metrics`        | Submission metrics dashboard for SAIS, WER, safe recovery, and dangerous-error evidence.                                                                                                                                             |

The dashboard and utility pages all share the same Vite dev server (single process, single port).

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

The server starts on **HTTPS** with a self-signed certificate (required so phones on the LAN can use `getUserMedia`). At startup it prints access URLs for `/`, `/audio`, and `/gemini-preview` for both localhost and your LAN IP. Phones need to accept the self-signed cert warning once.

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

## LiveKit setup (for walkie-talkie voice/data only)

Add your credentials from [cloud.livekit.io](https://cloud.livekit.io) (free tier, no card required):

```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxx
LIVEKIT_API_SECRET=your-secret
```

Without credentials the dashboard, Gemini preview, and `/audio` still open locally, but walkie-talkie voice/data packets cannot leave the browser.

## Gemini setup (for `/gemini-preview`)

Add a server-side Gemini key to the root `.env`:

```
GEMINI_API_KEY=your-gemini-api-key
GEMINI_CAMERA_MODEL=gemini-2.5-flash-lite
```

`/gemini-preview` and the dashboard CAM-03 analyzer keep the key on the server via `src/lib/gemini-camera-analysis.ts`. The default model is Gemini 2.5 Flash Lite for fast frame-based visual checks. Voice questions are recorded as short WAV clips and sent with the current frame. The dashboard analyzes only CAM-03, using short ordered frame bursts from the live MacBook camera; if it sees a review-worthy change, it publishes a `sentinel.visual-alert` data packet into the LiveKit voice room. You can override `GEMINI_CAMERA_MODEL` if your account exposes another model.

## Camera analysis

LiveKit is no longer used for video. Demo clips live in `public/cams/` for CAM-01, CAM-02, CAM-04, CAM-05, CAM-06, CAM-07, and CAM-08. CAM-03 opens the local browser camera on the dashboard and is the only feed sent to Gemini. Use an iPhone connected to the Mac as Continuity Camera if you want that camera source to appear as the Mac camera input.

## Live voice log

The dashboard joins `sentinel-live` as a subscriber for voice-agent data packets on topic `sentinel.voice` and Gemini visual alerts on `sentinel.visual-alert`. The Python agent in `../apps/voice` listens to the `/audio` participant, transcribes guard speech, interprets commands, speaks visual alerts from Gemini, and publishes `assistant_turn`, `guard_turn`, and `interaction_record` packets. Those packets update the review log in real time.

To test the voice path, run the Python voice worker and dispatch it into `sentinel-live`, then open `/audio` and hold the talk button while speaking. Use `/audio?identity=...` only if the agent's `LIVEKIT_MIC_IDENTITY` is set to the same value.

## Project layout

```
src/
  routes/
    index.tsx              # Dashboard (/)
    audio.tsx              # Walkie-talkie mic publisher (/audio)
    gemini-preview.tsx     # Local camera + Gemini visual chat (/gemini-preview)
  components/sentinel/     # Dashboard UI components
  lib/
    camera-config.ts       # Dashboard camera names, ordering, and demo clip paths
    livekit-token.ts       # TanStack Start server fn — mints LiveKit JWTs
    gemini-camera-analysis.ts # TanStack Start server fn — Gemini frame analysis
    publish-visual-alert.ts # Publishes Gemini visual alerts into LiveKit data
    use-sentinel-voice-events.ts # Hook — subscribes to voice-agent data packets
    live-page-skeleton.tsx # SSR-safe skeleton for camera/mic pages
vite.config.ts             # HTTPS cert, root env loading, startup URL banner
wrangler.jsonc             # Cloudflare Workers deploy config
```

## Push changes

```bash
git checkout -b your-feature
# ...edit files...
git add -A
git commit -m "describe the change"
git push -u origin your-feature
```

Then open a PR against `main` on GitHub. Push directly to `main` only for trivial fixes.

## Deploy (Cloudflare)

```bash
bunx wrangler deploy
```

You'll need to be logged in (`bunx wrangler login`) and have access to the target Cloudflare account. The LiveKit server functions run via the Workers Node.js compatibility layer.

## Related

Planning, demo flow, and safety guardrails live in the parent workspace:

- `../docs/agent-context.md` — product context
- `../docs/demo-plan.md` — demo flow
- `../docs/sentinel-audio-intelligence-metric.md` — SAIS and audio evidence
