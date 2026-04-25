# Sentinel Agent Context

## Current Idea

Sentinel is a **voice-first retail security copilot** for the **telli + ai-coustics** track.

It watches live CCTV/store camera feeds, flags review-worthy activity, speaks concise alerts to a security guard through an earpiece, understands the guard's spoken response in noisy store conditions, and logs rich review/error reports.

One-line pitch:

> Sentinel helps retail security teams hear, review, and respond to camera events hands-free, even in noisy supermarkets.

## Track Fit

Primary track:

- **telli + ai-coustics: Voice AI that works in the wild**

Why it fits:

- Real-world audio is central, not decorative.
- The guard operates in noisy stores with music, checkout beeps, carts, customers, and radio chatter.
- ai-coustics improves the audio path so the agent can hear commands reliably.
- The demo should show a measurable audio improvement or task-completion improvement.

Fallback:

- Wildcard

## Product Loop

1. CCTV/live camera feed shows a review-worthy retail event.
2. Vision model analyzes the clip and produces a non-accusatory scene summary.
3. Sentinel alerts the guard through an earpiece.
4. Guard responds by voice in noisy store audio.
5. ai-coustics enhances the audio.
6. Voice layer interprets the command.
7. Sentinel opens video, routes action, or creates an error report.
8. System stores the video context, voice context, transcript, command, confidence, and action.

Example earpiece alert:

> Aisle 5 requires review. Item appears to move from shelf to pocket. Human review recommended.

Example guard commands:

- open aisle five
- watch live
- replay last ten seconds
- send floor associate
- false alarm
- create report

## Report Value

Every alert/review can store:

- camera ID and store zone
- triggering video frame or clip
- visual scene summary
- assistant message to guard
- raw guard audio
- enhanced audio
- transcript attempt
- interpreted command
- confidence score
- action taken
- error reason, if any
- final human correction, if any

The error report is a key differentiator: when the voice agent fails, Sentinel preserves enough context to debug the failure.

## Safety Guardrails

- No facial recognition.
- No identity tracking.
- No automated accusation.
- No automated detention, punishment, or enforcement.
- Always require human review before store action.
- Say "requires review", not "is stealing".
- Describe observable behavior only.

Preferred language:

- "possible loss-prevention review"
- "observable shelf-to-pocket sequence"
- "camera requires human review"
- "voice command unclear"

Avoid:

- "thief"
- "criminal"
- "this person is stealing"
- identity or intent claims

## Demo Shape

Show:

- supermarket/shop camera dashboard
- many previewable camera feeds
- one analyzed live/control feed
- one staged visual event
- earpiece alert transcript
- noisy guard command
- ai-coustics enhanced transcript
- command confidence
- opened evidence video
- review or error report

Simple metric:

- command recognition with vs. without ai-coustics
- transcript confidence before/after enhancement
- task completion under store noise

## Partner Tech

Use at least 3 partner technologies.

Core implementation stack:

- ai-coustics: noisy audio enhancement
- Gradium: realtime voice interaction
- Google DeepMind: video/scene understanding
- Entire: human review and error-report workflow

Side challenge focus:

- Gradium: pursue through the realtime voice loop.
- Entire: pursue through review tasks, action tracking, and error-report workflow.
- Aikido: pursue if setup is quick by connecting the public repo and submitting the security report screenshot.

Optional product additions:

- Tavily: store policy/review guidance

Note:

Aikido is a side challenge only and does not count toward the 3 required partner technologies.

## UI Implementation

The dashboard UI lives in a separate repository, cloned locally at `ui/`:

- Repo: https://github.com/terdessa/sentinel-watch
- Stack: Vite + React + TypeScript + Tailwind + shadcn/ui + Bun, Cloudflare deploy target
- Originally scaffolded in Lovable, now developed directly

### UI Architecture Decisions

- **Cameras are video-only.** They do not capture audio. The guard's voice comes from a separate earpiece/mic device that connects to the backend independently. The dashboard must never imply cameras are listening.
- **AI agent continuously analyzes all camera feeds**, not just the alerted one. Tiles should show a subtle "analyzing" indicator on every camera so the always-on pipeline is visible.
- **Two-way voice channel.** Agent → guard (TTS to earpiece), guard → agent (speech with ai-coustics enhancement). Both directions are surfaced in the UI.

### UI Layout

- Single page, dark theme, security-ops aesthetic. Deep slate background, monospaced numerals, amber/red accents for alerts, teal for normal state.
- **No top bar.** A small ambient "🟢 Sentinel is watching" pill in a corner is the only persistent status element. It shifts to "🟠 Sentinel flagged CAM-XX — requires review" when an alert fires.
- **Camera grid** (top ~40% viewport): 8–12 small live tiles, each with continuous-analysis indicator, camera ID, zone label, live dot. The active alert tile pulses amber.
- **Alert video panel** (below grid, ~50% width): large playback of the flagged camera with non-accusatory scene summary overlay, scrubber, replay-last-10s, watch-live, and a visual-model confidence bar.
- **Right-side log panel** (other ~50% width): collapsed by default; slides in only when an alert is active.

### Review Record / Log Panel

- **Conversation history is text-only — no audio waveforms or playback.** Chat-style stack with two speakers:
  - **Sentinel** — left, teal accent, shield icon
  - **Guard · earpiece** — right, amber accent, headset icon
- Each message: speaker label, text, timestamp; guard messages also show a confidence chip.
- Low-confidence guard messages render with a dashed border and inline "voice command unclear — clarification requested" note.
- "Live" pulse at the top of the panel while the channel is open; "channel closed" once the alert is resolved.
- Status badges and footer actions (Send floor associate, Mark false alarm, Create report) sit below the conversation.

## Next Open Question

Define the exact schema for:

- visual event
- voice command
- action result
- error report (text-conversation transcript instead of audio blobs)
