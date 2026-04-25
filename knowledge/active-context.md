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

The dashboard is at `ui/`. Stack: Vite + React + TS + Tailwind + shadcn/ui + Bun, Cloudflare deploy.

- No top bar. Ambient "Sentinel is watching" corner pill is the only persistent status.
- Camera grid on top, 8–12 video-only tiles, each shows continuous-analysis indicator.
- Alert video panel below the grid, ~50% width.
- Right-side log panel slides in only on alert.
- Review record uses **text-only chat history** between Sentinel and Guard — no audio waveforms.
- Demo toggle simulates an alert on CAM-05 with a hardcoded mock conversation.

## Voice service (Person 3)

Running at `apps/voice/`. Python + LiveKit + ai-coustics plugin.

- Agent connected to LiveKit cloud: `wss://berlin-vc00ggsm.livekit.cloud`
- ai-coustics QUAIL_L wired via `RoomInputOptions(noise_cancellation=...)`
- OpenAI STT/TTS as voice runtime (telli-swappable in two lines)
- Command interpreter: 6 commands, ACTION_THRESHOLD=0.7, failure-mode classification
- Every interaction logged to `apps/voice/submission/interactions.json`

## Track differentiator

Every voice interaction → structured JSON record + raw/enhanced audio files.
Failure records include NISQA scores, conversation history, visual context, failure mode classification, and natural-language explanation. The corpus is a data product ai-coustics can take home.

## Side challenge focus

- Entire: push at least one error record as a review task
- Aikido: connect repo and screenshot if setup is quick

## Safety

- Action threshold: 0.7 command confidence. Below → clarification, not action.
- Max 3 clarification attempts → error record.
- All language non-accusatory.

## Next task

Connect the live voice agent output to the UI's LiveKit room so guard commands flow into the conversation log in real time.
