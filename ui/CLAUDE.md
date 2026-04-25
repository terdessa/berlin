# CLAUDE.md

Guidance for AI coding agents working in this repository.

## What this is

**Sentinel** — a voice-first retail security copilot. This repository is the **dashboard UI only**. There is no backend, no real video pipeline, and no real audio processing in this repo. All data is mocked in-memory.

One-line pitch: *Sentinel helps retail security teams hear, review, and respond to camera events hands-free, even in noisy supermarkets.*

Built for the **telli + ai-coustics** track of Big Berlin Hack. Originally scaffolded in Lovable.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- shadcn/ui (Radix primitives) — see `components.json`
- Bun for install / dev / build (`bun install`, `bun run dev`)
- Cloudflare Workers deploy via `@cloudflare/vite-plugin` and `wrangler.jsonc`

## Pipeline this UI represents

1. An AI agent continuously analyzes every camera feed.
2. On a review-worthy event, the dashboard flags the camera and Sentinel speaks an alert to the guard's earpiece.
3. The guard replies by voice through a **separate earpiece/mic device** — not via the cameras.
4. ai-coustics enhances the guard audio.
5. The voice layer interprets the command.
6. Sentinel opens the evidence video, routes the action, or creates an error report.
7. The two-way voice channel stays open for follow-ups.

## Hard rules — non-accusatory language

This is a **human-review** tool, not an accusation system. Anywhere user-visible text is written or generated:

- ✅ "requires review", "observable shelf-to-pocket sequence", "possible loss-prevention review", "voice command unclear", "clarification needed"
- ❌ "thief", "criminal", "stealing", "guilty", any identity claim, any intent claim

Show confidence scores, not verdicts. No facial recognition, no identity tracking, no automated enforcement language anywhere in the UI.

## Architectural rules

- **Cameras are video-only.** Never render mic icons on camera tiles. Never imply the cameras hear anything. Audio comes from the separate earpiece device.
- **Every camera tile shows a continuous-analysis indicator.** The agent watches *all* feeds, not only the alerted one — the UI must reflect that.
- **No backend calls.** Data is hardcoded mocks and local state. Do not add API clients, auth, or routing for backend resources.

## Layout

Single page, dark theme, security-ops aesthetic — deep slate background, monospaced numerals, amber/red for alerts, teal for normal.

- **No top bar.** A small ambient "🟢 Sentinel is watching" pill in a corner is the only persistent status. It shifts to "🟠 Sentinel flagged CAM-XX — requires review" when an alert is active.
- **Camera grid** (top region, ~40% viewport): 8–12 small live tiles. Each shows looping mock video, camera ID + zone label, live dot, and an analyzing indicator. The active alert tile pulses amber.
- **Alert video panel** (below the grid, ~50% width): large playback of the flagged camera. Includes non-accusatory scene summary overlay, scrubber, replay-last-10s, watch-live, and a visual-model confidence bar.
- **Right-side log panel** (other ~50% width): collapsed by default. Slides in only when an alert is active. Closes when the alert is resolved.
- **Demo toggle** (small corner button) simulates an alert on CAM-05 for the demo flow.

## Review record / log panel

- **Text-only conversation history** between Sentinel and the guard. No audio waveforms, no play buttons, no raw audio UI anywhere.
- Two speakers, visually distinct:
  - **Sentinel** — left, teal accent, shield icon
  - **Guard · earpiece** — right, amber accent, headset icon
- Each message: speaker label, text, timestamp (HH:MM:SS); guard messages include a confidence chip.
- Low-confidence guard messages render with a dashed border and inline "voice command unclear — clarification requested" note. Show the interpreted text, not raw garbled transcript.
- A "live" pulse at the top of the panel while the channel is open; "channel closed" once resolved.
- Below the conversation: status badges ("Awaiting human review", "Floor associate dispatched", "Marked false alarm", "Error report created") and footer actions (Send floor associate, Mark false alarm, Create report).

## Mock data conventions

- 10 cameras across zones (Entrance, Aisle 1–5, Checkout, Storage, Back exit).
- One pre-built alert event for CAM-05 with the full review-record payload.
- Mock conversation for CAM-05:
  1. Sentinel — "Aisle 5 requires review. Item appears to move from shelf to pocket. Human review recommended." — 14:22:08
  2. Guard — "Open aisle five." — 14:22:14 — confidence 0.91
  3. Sentinel — "Opening Aisle 5 evidence video now." — 14:22:15
  4. Guard — "Send floor associate and create report." — 14:22:31 — confidence 0.88
  5. Sentinel — "Floor associate dispatched. Review record created." — 14:22:33

## Side-challenge integrations the UI should be ready to display

- **ai-coustics**: surfaced via the confidence delta between raw and enhanced transcripts (in mock data; the UI just shows the result).
- **Gradium**: realtime voice loop — the conversation panel represents this.
- **Entire**: review tasks and error reports — the status badges and footer actions are the surface.

## Accessibility

- Visible focus rings on all interactive controls.
- `role="alert"` on the live alert region only when an alert is active.
- Responsive down to 1280px; mobile is not required.

## Out of scope for this repo

Auth, routing for protected pages, real video streams, real audio capture/processing, API clients, persistent storage. Keep it presentational.
