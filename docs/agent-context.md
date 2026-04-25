# Sentinel Agent Context

## Current Idea

Sentinel is a **voice-first retail security copilot** for the **telli + ai-coustics** track.

It watches live CCTV/store camera feeds, flags review-worthy activity, speaks concise alerts to a security guard through an earpiece, understands the guard's spoken response in noisy store conditions, and — when it cannot be sure what the guard said — produces a richly diagnosed error record that ai-coustics can use as evaluation/training data for their model. The full session ships as a structured JSON corpus alongside the demo.

One-line pitch:

> Sentinel helps retail security teams hear, review, and respond to camera events hands-free, even in noisy supermarkets — and turns every voice failure into labeled, contextualized data ai-coustics can take home and learn from.

## Track Fit

Primary track:

- **telli + ai-coustics: Voice AI that works in the wild**

Why it fits:

- Real-world audio is central, not decorative.
- The guard operates in noisy stores with music, checkout beeps, carts, customers, and radio chatter.
- ai-coustics improves the audio path so the agent can hear commands reliably.
- The demo shows a measurable NISQA MOS uplift (raw vs enhanced) and a corpus of labeled failure cases — both of which directly answer the track's "audio intelligence metric" requirement.

Voice runtime stack: **LiveKit** as the agent framework (using the official [livekit/plugins-ai-coustics-python](https://github.com/livekit/plugins-ai-coustics-python) plugin), **telli** for STT + TTS + realtime conversation, **ai-coustics** for audio enhancement in front of telli. We deliberately do not stack any third-party voice runtime on top of telli, so ai-coustics stays the single variable in the before/after metric.

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

To make the corpus look like a dataset rather than one demo clip, the demo runs at least six scripted scenarios with varied noise types and outcomes (see `docs/person-3-voice-error-logging.md`).

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
- a `submission/` folder with `interactions.json` + audio files we can hand to the judges

Primary metric: NISQA MOS uplift from raw to enhanced, averaged across a scripted scenario set, with the per-scenario breakdown visible.

Secondary metric: command recognition rate with vs without ai-coustics on the same scenario set.

Both metrics are computed from `interactions.json` so they are reproducible from the corpus alone.

## Partner Tech

Use at least 3 partner technologies.

Core implementation stack:

- ai-coustics: noisy audio enhancement, integrated via the official `livekit/plugins-ai-coustics-python` plugin
- LiveKit: voice agent framework that hosts the ai-coustics plugin
- telli: realtime voice interaction (track host runtime)
- Google DeepMind: video/scene understanding
- Entire: human review and error-report workflow
- NISQA v2 (`gabrielmittag/NISQA`): objective audio quality metric for raw vs enhanced

Side challenge focus:

- Entire: pursue through review tasks, action tracking, and error-report workflow.
- Aikido: pursue if setup is quick by connecting the public repo and submitting the security report screenshot.

Optional product additions:

- Tavily: store policy/review guidance

Note:

Aikido is a side challenge only and does not count toward the 3 required partner technologies.

## Open Questions

- Confirm ai-coustics SDK credentials / LiveKit plugin auth path with the booth.
- Confirm telli SDK setup for the demo machine.
- Confirm whether `interactions.json` should be submitted as a separate artifact or zipped with the project repo.
