# Active Context

Sentinel is a **voice-first retail security copilot** for the **telli + ai-coustics** track.

## Pipeline

1. AI agent continuously analyzes all CCTV/live camera feeds.
2. When review-worthy behavior appears, the dashboard flags the camera and Sentinel speaks an alert to the guard's earpiece.
3. Guard responds by voice through a separate earpiece/mic device (not via the cameras).
4. ai-coustics enhances the guard audio.
5. Voice layer interprets the command.
6. Sentinel opens the relevant evidence video, routes the action, or creates an error report.
7. Two-way voice channel stays open during the review.

## Guardrails

- no facial recognition
- no identity tracking
- no automated theft claim
- no automated enforcement
- human review before any action
- non-accusatory language only ("requires review", not "stealing")

## UI

The dashboard repo is cloned at `ui/` (https://github.com/terdessa/sentinel-watch). Stack: Vite + React + TS + Tailwind + shadcn/ui + Bun, Cloudflare deploy.

Layout decisions made:

- No top bar. Ambient "Sentinel is watching" corner pill is the only persistent status.
- Camera grid on top, 8–12 video-only tiles, each shows continuous-analysis indicator.
- Alert video panel below the grid, ~50% width.
- Right-side log panel slides in only on alert; closed otherwise.
- Review record uses **text-only chat history** between Sentinel and Guard — no audio waveforms or playback.
- Demo toggle simulates an alert on CAM-05 with a hardcoded mock conversation.

## Side challenge focus

- Gradium and Entire are the main implementation targets.
- Aikido is worth doing if setup is quick.

## Next useful task

Define schemas for visual event, voice command, action result, and error report (with text-only conversation transcript).
