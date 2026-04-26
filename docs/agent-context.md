# Sentinel Agent Context

## Current Idea

Sentinel is a **voice-first retail security copilot** using LiveKit, Gradium, ai-coustics, and Gemini.

It watches live CCTV/store camera feeds, flags review-worthy activity, speaks concise alerts to a security guard through an earpiece, understands the guard's spoken response in noisy store conditions, and — when it cannot be sure what the guard said — produces a richly diagnosed error record that ai-coustics can use as evaluation/training data for their model. The full session ships as a structured JSON corpus alongside the demo.

One-line pitch:

> Sentinel helps retail security teams hear, review, and respond to camera events hands-free, even in noisy supermarkets — and turns every voice failure into labeled, contextualized data ai-coustics can take home and learn from.

## Track Fit

Primary track:

- **Voice AI that works in the wild**

Why it fits:

- Real-world audio is central, not decorative.
- The guard operates in noisy stores with music, checkout beeps, carts, customers, and radio chatter.
- ai-coustics improves the audio path so the agent can hear commands reliably.
- The demo shows a measurable Sentinel Audio Intelligence Score (SAIS), raw/enhanced audio evidence, and a corpus of labeled failure cases — all directly answer the track's "audio intelligence metric" requirement.

Voice runtime stack: **LiveKit** as the agent framework, **Gradium** for STT + TTS, and **ai-coustics** for audio enhancement.

Fallback:

- Wildcard

## Product Loop

1. A local Mac/iPhone Continuity Camera feed shows a review-worthy retail event.
2. Gemini analyzes local browser frames and produces a non-accusatory scene summary.
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

## Report Value (Track Differentiator)

Every interaction (success or failure) is written to a JSON corpus file with audio files alongside, so the whole session can be shared with the ai-coustics team after the demo.

A single interaction record stores:

- camera ID and store zone
- triggering video frame or clip
- visual scene summary and confidence
- assistant message to guard
- raw guard audio
- enhanced audio
- NISQA v2 scores for raw and enhanced (MOS plus four sub-dimensions)
- estimated SNR and noise tag
- raw and enhanced transcript attempts
- interpreted command, command candidates, and confidence
- action taken
- failure classification and natural-language explanation, if any
- suggested clarification question, if any
- final human correction, if any

Why this is the track wedge: the official ai-coustics track asks teams to design an audio intelligence metric and show what it looks like when the agent passes it. The judge added that real-world failure data is expensive to collect and that diverse, contextualised failure scenarios help the company improve the product. Our corpus is positioned as that data product, not just hackathon evidence.

Failure classifications used in the corpus:

- `acoustic_residual_noise` — enhanced NISQA still low; their problem to fix
- `acoustic_confusion` — clean audio but acoustically similar tokens confused (floor vs four)
- `semantic_ambiguity` — clean audio, clear words, multiple valid commands
- `out_of_vocabulary` — clean audio, clear words, no supported command
- `multi_cause` — combination

SAIS is the headline metric. It measures `(correct actions + safe recoveries) / total commands`, so a context-target mismatch that triggers clarification is a success, while opening the wrong camera is a dangerous error. NISQA/DNSMOS and WER remain supporting metrics. See `docs/sentinel-audio-intelligence-metric.md`.

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
- NISQA score before and after enhancement
- command confidence and candidates considered
- opened evidence video on a successful command
- a richly diagnosed error record (with failure classification and suggested clarification) when a command is unclear
- `apps/voice/submission/` with `interactions.json` + audio files we can hand to the judges

Primary metric: SAIS, shown across raw audio, ai-coustics-enhanced audio, and ai-coustics plus Sentinel context validation.

Secondary metrics: dangerous error rate, WER, NISQA/DNSMOS uplift, and retry/safe recovery rate.

Both metrics are computed from `interactions.json` so they are reproducible from the corpus alone.

## Partner Tech

Use at least 3 partner technologies.

Core implementation stack:

- ai-coustics: noisy audio enhancement, integrated via the official `livekit/plugins-ai-coustics-python` plugin
- LiveKit: voice agent framework that hosts the ai-coustics plugin
- Gradium: realtime STT/TTS voice runtime
- Google DeepMind: video/scene understanding
- Entire: human review and error-report workflow
- NISQA v2 (`gabrielmittag/NISQA`): objective audio quality metric for raw vs enhanced

Side challenge focus:

- Entire: pursue through review tasks, action tracking, and error-report workflow.
- Aikido: pursue if setup is quick by connecting the public repo and submitting the security report screenshot.

Aikido is a side challenge only and does not count toward the 3 required partner technologies.

## UI Implementation

The dashboard UI lives at `ui/` in this repo:

- Stack: Vite + React + TypeScript + Tailwind + TanStack Start (SSR) + Bun, Cloudflare deploy target
- Dev server runs over **HTTPS** (self-signed cert) — required for `getUserMedia` on non-localhost devices
- Originally scaffolded in Lovable, now developed directly

### UI Architecture Decisions

- **Cameras are video-only.** They do not capture audio. The guard's voice comes from the phone walkie-talkie page.
- **Gemini analyzes only CAM-03.** Other dashboard cameras are local looping demo clips.
- **Two-way voice channel.** Agent → guard (TTS to the phone speaker), guard → agent (speech from the phone mic with ai-coustics enhancement). The dashboard surfaces both directions in the review log.
- **Local camera analysis.** LiveKit is not used for video transport. The dashboard has eight camera tiles: CAM-01, CAM-02, CAM-04, CAM-05, CAM-06, CAM-07, and CAM-08 loop local demo clips from `ui/public/cams`; CAM-03 opens the local laptop/Continuity Camera and is the only feed sampled by Gemini. Structured visual alerts go into the voice room as data packets.
- **5-frame motion bursts.** Each Gemini call is a sequence of five JPEG frames captured at 200 ms intervals (5 fps over ~1 s) instead of a single still. The detector mode is `object-hold`: Gemini replies `HOLD` when a person is visibly holding a picked-up object, otherwise `NONE`. A `HOLD` reply triggers one alert per page-load (refresh to re-arm).
- **Phone walkie-talkie.** The `/voice` route publishes the guard microphone to `sentinel-live` as `sentinel-guard-mic` by default. The Python voice agent listens to that participant, runs ai-coustics + Gradium STT/TTS, calls Gemini for the spoken reply, and publishes Sentinel/Guard turns plus interaction records on the `sentinel.voice` LiveKit data topic. The dashboard consumes those packets through `use-sentinel-room.ts` and updates the review log in real time.
- **Dashboard is mic-less.** The dashboard at `/` joins LiveKit as identity `sentinel-dashboard` for data only — no `getUserMedia`, no remote-audio playback, no walkie-talkie button.

### Live Utility Pages

- **`/voice`** — phone walkie-talkie. Press-and-hold mic button, plays the agent's TTS through the phone speaker. Joins LiveKit as `sentinel-guard-mic`. The dev server prints a LAN URL at startup that you open on the phone (accept the self-signed cert once).
- **`/metrics`** — submission metrics dashboard for SAIS, WER, safe recovery, and dangerous-error evidence.

The dev server prints LAN + localhost URLs for `/`, `/voice`, and `/metrics` at startup.

### UI Layout

- Single page, dark theme, security-ops aesthetic. Deep slate background, monospaced numerals, amber/red accents for alerts, teal for normal state.
- Compact operations header with Sentinel status, audio metric, CAM-03 input selector, and current recording state.
- **Camera grid** (top region): 8 tiles. Seven tiles loop local placeholder videos; CAM-03 shows the live device camera and is analyzed by Gemini.
- **Alert video panel** (below grid, ~50% width): flagged camera playback with scene summary overlay.
- **Right-side log panel** (other ~50% width): slides in only when an alert is active.

### Review Record / Log Panel

- **Conversation history is text-only — no audio waveforms or playback.** Chat-style with two speakers: Sentinel (left, teal) and Guard (right, amber).
- Guard messages show a confidence chip. Low-confidence messages render with dashed border and "voice command unclear" note.
- Status badges and footer actions (Send floor associate, Mark false alarm, Create report) sit below the conversation.

## Current Implementation

- ai-coustics credentials: configured in LiveKit Cloud project (no local env var) ✅
- LiveKit cloud: connected ✅ (`wss://berlin-vc00ggsm.livekit.cloud`)
- Gradium STT/TTS: wired as the voice runtime ✅
- Gemini 2.5 Flash Lite: powers both the CAM-03 `object-hold` detector and the agent's spoken replies ✅
- `interactions.json` corpus: written per session by `apps/voice/src/logger.py` ✅
- Dashboard camera grid: local clips + Gemini analysis on CAM-03 ✅ — no LiveKit video transport
- Dashboard live voice log: working ✅ — `apps/voice` emits `sentinel.voice` data packets and the dashboard subscribes via `use-sentinel-room.ts`
- Phone walkie-talkie at `/voice`: working ✅ — publishes the phone mic to `sentinel-live`; agent's TTS plays back on the phone speaker
- Visual alerts from CAM-03: wired ✅ — the dashboard publishes `sentinel.visual-alert`; the voice agent speaks the alert into the room (heard on the phone) and Gemini answers follow-up questions using the cached frame
