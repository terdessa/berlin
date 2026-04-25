# Sentinel — UI

Front-end for **Sentinel**, a voice-first retail security copilot.

Built with Vite + React + TypeScript + Tailwind + shadcn/ui + TanStack Start (SSR). Originally scaffolded in Lovable.

> Sentinel is a *human-review* tool. It surfaces review-worthy camera events; it does not accuse, identify, or enforce. Keep all UI language non-accusatory.

## What lives here

| Route | Description |
|-------|-------------|
| `/` | Security ops dashboard. Camera grid shows real live feeds from connected devices (via LiveKit) and falls back to placeholders when no devices are connected. Alert video panel and review log are driven by mock data. |
| `/video` | Direct-link publisher page. Opens the device camera (with a multi-lens switcher on phones), publishes into the `sentinel-live` LiveKit room, and subscribes to other publishers. Shows a real-time stats panel (kbps, fps, resolution, codec, quality-limitation reason). |
| `/audio` | Direct-link publisher page. Same as `/video` but for the microphone. |

The dashboard and the two utility pages all share the same Vite dev server (single process, single port).

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

The server starts on **HTTPS** with a self-signed certificate (required so phones on the LAN can use `getUserMedia`). At startup it prints access URLs for `/`, `/video`, and `/audio` for both localhost and your LAN IP. Phones need to accept the self-signed cert warning once.

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

Without credentials the dashboard and utility pages still work — cameras show placeholders and `/video`/`/audio` run in local-preview-only mode.

## Live camera grid

The dashboard automatically subscribes to the `sentinel-live` LiveKit room as a viewer. Connected publisher devices fill the camera tiles from left to right (CAM-01 gets the first connected device, CAM-02 gets the second, and so on). Tiles without a live feed show the existing placeholder animation.

To stream from a phone or second device, open `https://<laptop-LAN-IP>:<port>/video` on that device.

## Project layout

```
src/
  routes/
    index.tsx              # Dashboard (/)
    video.tsx              # Camera publisher (/video)
    audio.tsx              # Mic publisher (/audio)
  components/sentinel/     # Dashboard UI components
  lib/
    livekit-token.ts       # TanStack Start server fn — mints LiveKit JWTs
    use-livekit-feeds.ts   # Hook — viewer subscriber, returns ordered live tracks
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
