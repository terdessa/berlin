# Sentinel — UI

Front-end for **Sentinel**, a voice-first retail security copilot. This repo contains the dashboard only — no backend, no real video, no real audio. All data is mocked in-memory.

Built with Vite + React + TypeScript + Tailwind + shadcn/ui. Originally scaffolded in Lovable.

> Sentinel is a *human-review* tool. It surfaces review-worthy camera events; it does not accuse, identify, or enforce. Keep all UI language non-accusatory.

## Prerequisites

- [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`)
- Git
- Node 18+ is fine as a fallback if you prefer `npm` over `bun`

## Run locally

```bash
git clone https://github.com/terdessa/sentinel-watch.git
cd sentinel-watch
bun install
bun run dev
```

Open the URL Vite prints (typically http://localhost:5173).

Other scripts:

```bash
bun run build       # production build
bun run preview     # serve the production build
bun run lint        # eslint
bun run format      # prettier write
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

## Project layout

```
src/                 # app source
components.json      # shadcn/ui config
vite.config.ts       # Vite + Cloudflare plugin config
wrangler.jsonc       # Cloudflare Workers deploy config
```

## Deploy (Cloudflare)

The repo is wired for Cloudflare via `@cloudflare/vite-plugin` and `wrangler.jsonc`. Deploy with:

```bash
bunx wrangler deploy
```

You'll need to be logged in (`bunx wrangler login`) and have access to the target Cloudflare account.

## Related

Planning, demo flow, and safety guardrails live in the parent workspace:

- `../docs/agent-context.md` — product context
- `../docs/demo-plan.md` — demo flow
- `../docs/risks-and-safety.md` — language and safety rules
