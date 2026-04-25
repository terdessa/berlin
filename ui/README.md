# Sentinel — UI

Front-end for **Sentinel**, a voice-first retail security copilot.

Built with Vite + React + TypeScript + Tailwind + shadcn/ui + TanStack Start (SSR). Originally scaffolded in Lovable.

> Sentinel is a *human-review* tool. It surfaces review-worthy camera events; it does not accuse, identify, or enforce. Keep all UI language non-accusatory.

## What lives here

| Route | Description |
|-------|-------------|
| `/` | Security ops dashboard. Camera grid shows real live feeds from connected devices (via LiveKit). The review log supports live voice-agent data packets. |
| `/video` | Direct-link publisher page. Opens the device camera (with a multi-lens switcher on phones), publishes into the `sentinel-live` LiveKit room, and subscribes to other publishers. Shows a real-time stats panel (kbps, fps, resolution, codec, quality-limitation reason). |
| `/audio` | Direct-link publisher page. Same as `/video` but for the microphone. Defaults to identity `sentinel-guard-mic`, which the Python voice agent listens to. |
| `/gemini-preview` | Direct-link MacBook camera analyst. Opens the local camera, captures frames on demand, and sends them through a server-side Gemini API bridge for visual chat and auto-commentary. |

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

The server starts on **HTTPS** with a self-signed certificate (required so phones on the LAN can use `getUserMedia`). At startup it prints access URLs for `/`, `/video`, `/audio`, and `/gemini-preview` for both localhost and your LAN IP. Phones need to accept the self-signed cert warning once.

Other scripts:

```bash
bun run build       # production build
bun run preview     # serve the production build
bun run lint        # eslint
bun run format      # prettier write
```

## LiveKit setup (for live video in the dashboard)

Copy `.env.example` to `.env` and fill in your credentials from [cloud.livekit.io](https://cloud.livekit.io) (free tier, no card required):

```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxxxxxxxxx
LIVEKIT_API_SECRET=your-secret
```

Without credentials the dashboard and utility pages still work — the dashboard shows a no-publishers state and `/video`/`/audio` run in local-preview-only mode.

## Gemini setup (for `/gemini-preview`)

Add a server-side Gemini key to `.env`:

```
GEMINI_API_KEY=your-gemini-api-key
GEMINI_CAMERA_MODEL=gemini-3.1-pro-preview
```

`/gemini-preview` keeps the key on the server via `src/lib/gemini-camera-analysis.ts`. The default model is Gemini 3.1 Pro Preview for frame-based visual reasoning. You can override `GEMINI_CAMERA_MODEL` if your account exposes a live-specific model.

## Live camera grid

The dashboard automatically subscribes to the `sentinel-live` LiveKit room as a viewer. Connected publisher devices fill the camera grid from left to right.

To stream from a phone or second device, open `https://<laptop-LAN-IP>:<port>/video` on that device.

## Live voice log

The dashboard also joins `sentinel-live` as a subscriber for voice-agent data packets on topic `sentinel.voice`. The Python agent in `../apps/voice` listens to the `/audio` participant, transcribes guard speech, interprets commands, and publishes `assistant_turn`, `guard_turn`, and `interaction_record` packets. Those packets update the review log in real time.

To test the voice path, run the Python voice worker and dispatch it into `sentinel-live`, then open `/audio` and speak. Use `/audio?identity=...` only if the agent's `LIVEKIT_MIC_IDENTITY` is set to the same value.

## Project layout

```
src/
  routes/
    index.tsx              # Dashboard (/)
    video.tsx              # Camera publisher (/video)
    audio.tsx              # Mic publisher (/audio)
    gemini-preview.tsx     # Local camera + Gemini visual chat (/gemini-preview)
  components/sentinel/     # Dashboard UI components
  lib/
    livekit-token.ts       # TanStack Start server fn — mints LiveKit JWTs
    gemini-camera-analysis.ts # TanStack Start server fn — Gemini frame analysis
    use-livekit-feeds.ts   # Hook — viewer subscriber, returns ordered live tracks
    use-sentinel-voice-events.ts # Hook — subscribes to voice-agent data packets
    use-livekit-stats.ts   # Hook — polls WebRTC getStats() for the stats panel
    live-stats-panel.tsx   # Stats panel component
    live-page-skeleton.tsx # SSR-safe skeleton for /video and /audio
components.json            # shadcn/ui config
vite.config.ts             # HTTPS cert, env hoisting, startup URL banner
wrangler.jsonc             # Cloudflare Workers deploy config
.env.example               # Credential template (copy to .env, never commit .env)
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
- `../docs/risks-and-safety.md` — language and safety rules
