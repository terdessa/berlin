# Sentinel

Voice-first retail security copilot. Built with LiveKit, Gradium, ai-coustics, and Gemini.

> Sentinel helps retail security teams hear, review, and respond to camera events hands-free, even in noisy supermarkets.

Sentinel is a **human-review tool**: it surfaces review-worthy camera events and helps the guard act on them by voice. It does not accuse, identify, or enforce.

## What's in here

| Path | Description |
| --- | --- |
| `ui/` | Dashboard (`/`), phone walkie-talkie (`/voice`), and metrics page (`/metrics`). Vite + React + TanStack Start. |
| `apps/voice/` | Python LiveKit voice agent. Handles guard mic → ai-coustics → Gradium STT → Gemini reply → Gradium TTS, and writes the corpus. |
| `docs/` | Product and architecture docs. Start with `docs/agent-context.md`. |

## Quick start

1. Copy `.env.example` to `.env` and fill in `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `GEMINI_API_KEY`, `GRADIUM_API_KEY`. The ai-coustics key is set in the LiveKit Cloud project, not here.

2. **Terminal 1 — UI**:

   ```bash
   cd ui
   bun install
   bun run dev
   ```

   Vite prints a localhost URL (laptop dashboard) and a LAN URL (phone walkie-talkie). The cert is self-signed; accept the warning on each device once.

3. **Terminal 2 — Voice agent**:

   ```bash
   cd apps/voice
   python -m venv .venv
   .venv/Scripts/activate            # macOS/Linux: source .venv/bin/activate
   pip install -r requirements.txt
   python -m src.agent dev
   ```

   Wait for `self-dispatched agent into room=sentinel-live`.

4. Open `https://<laptop>:<port>/` on the laptop and `https://<lan-ip>:<port>/voice` on the phone. Hold the mic button on the phone to talk; the agent's reply plays back on the phone speaker, and the dashboard's conversation log updates in real time.

CAM-03 (the dashboard's live camera) is analyzed by Gemini with a 5-frame burst every 2 s. When it sees a person holding an object they just picked up, it fires one alert per page-load.

## Docs

- [`docs/agent-context.md`](docs/agent-context.md) — canonical product and architecture context.
- [`docs/demo-plan.md`](docs/demo-plan.md) — demo flow and scripted scenarios.
- [`docs/sentinel-audio-intelligence-metric.md`](docs/sentinel-audio-intelligence-metric.md) — SAIS metric and quality dashboard.
- [`apps/voice/README.md`](apps/voice/README.md) — voice agent details and benchmarks.
- [`ui/README.md`](ui/README.md) — UI dev workflow.
- [`CLAUDE.md`](CLAUDE.md) — operational rules for AI coding assistants working in the repo.

## Safety

No facial recognition, identity tracking, automated accusation, detention, punishment, or enforcement. The agent describes observable behavior, asks for clarification when unsure, and routes uncertain commands to a safe-recovery path rather than acting.
