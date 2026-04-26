# Sentinel Voice Service

Python voice agent using LiveKit + ai-coustics + Gradium + Gemini.

The agent listens to the phone walkie-talkie (`/voice` route in the UI), enhances the audio with ai-coustics, transcribes it with Gradium, generates a reply with Gemini 2.5 Flash Lite (with the latest CAM-03 frame attached when an alert is active), speaks the reply back through Gradium TTS, and writes a structured interaction record to `submission/interactions.json`.

## Setup

```bash
cd apps/voice
python3.12 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

If `python3.12` is not installed on your machine, use the available Python 3.12+ interpreter name instead.

## Credentials

Copy `.env.example` at the repo root to `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `LIVEKIT_URL` | LiveKit dashboard |
| `LIVEKIT_API_KEY` | LiveKit dashboard |
| `LIVEKIT_API_SECRET` | LiveKit dashboard |
| `GRADIUM_API_KEY` | Gradium voice runtime |
| `GEMINI_API_KEY` | Google AI Studio |
| `LIVEKIT_MIC_IDENTITY` | Optional; defaults to `sentinel-guard-mic` (must match the identity used by the `/voice` page) |
| `LIVEKIT_ROOM` | Optional; defaults to `sentinel-live` |

The ai-coustics SDK key is configured inside LiveKit Cloud (project → ai-coustics integration). The LiveKit room token and server URL are forwarded to the plugin at runtime — there is no local ai-coustics env var.

Optional latency tuning:

| Variable | Default | Effect |
|---|---|---|
| `SENTINEL_UTTERANCE_SILENCE_MS` | `350` | Trailing-silence window before flushing an utterance. |
| `SENTINEL_VAD_THRESHOLD` | `0.6` | Gradium STT VAD threshold (lower = more aggressive end-of-utterance). |
| `SENTINEL_VAD_BUCKET` | `1` | Gradium STT VAD look-ahead window selector (higher = more conservative). |

## Run the agent

```bash
cd apps/voice
source .venv/bin/activate
python -m src.agent dev
```

This starts a LiveKit worker registered with `agent_name="sentinel"`. On startup the worker creates the room (`sentinel-live`) if it doesn't exist, then self-dispatches into it — no second terminal needed. You should see `self-dispatched agent into room=sentinel-live` in the log.

## Manual dispatch (if needed)

```bash
cd apps/voice
source .venv/bin/activate
python -m src.dispatch_agent
```

The script is idempotent. Useful flags:

- `python -m src.dispatch_agent --status` — show active dispatches and participants.
- `python -m src.dispatch_agent --reset` — delete every active dispatch and `agent-*` participant in the room, then create one fresh dispatch.

## Walkie-talkie path

The walkie-talkie lives on the phone at `/voice` (printed by the UI dev server as the LAN URL).

```
phone /voice  →  LiveKit room sentinel-live (identity sentinel-guard-mic)
                       │
                       ├──► ai-coustics plugin (QUAIL_L) — runs server-side via LiveKit Cloud
                       │      │
                       │      └──► Gradium STT
                       │              │
                       │              ├──► interpret.py (regex command classifier)
                       │              │       └──► action routing + corpus record
                       │              │
                       │              └──► Gemini 2.5 Flash Lite
                       │                      (system prompt + active visual event + last frame
                       │                       + recent conversation history)
                       │                      │
                       │                      └──► Gradium TTS
                       │                              │
                       │                              └──► back to /voice (phone speaker)
                       │
                       └──► sentinel.voice data packets
                                ├──► assistant_turn (TTS text)
                                ├──► guard_turn (raw + enhanced transcript, NISQA)
                                ├──► visual_event (mirrored from dashboard)
                                └──► interaction_record (full corpus row)
```

The dashboard at `/` does not own the mic. It only subscribes to `sentinel.voice` and publishes `sentinel.visual-alert` packets when its CAM-03 analyzer detects a person holding a picked-up object.

When CAM-03 fires a visual alert the dashboard attaches a small JPEG of the scene; the agent caches that frame so any follow-up question from the guard ("what do you see", "describe the scene") goes to Gemini together with the actual frame.

## Output

Every voice interaction appends a record to:

```
apps/voice/submission/interactions.json
```

Raw and enhanced audio clips land in:

```
apps/voice/submission/audio/raw/
apps/voice/submission/audio/enhanced/
```

The `submission/` folder is the corpus handed to the judges.

## Demo scenarios

Six scripted scenarios are defined in `fixtures/scenarios.json`. Run through each one during the demo to populate a diverse corpus.

## Audio intelligence benchmark

The custom judge-facing metric is **Sentinel Audio Intelligence Score (SAIS)**:

```
SAIS = (correct actions + safe recoveries) / total test commands
```

Run the reproducible benchmark from the repo root:

```bash
python -m apps.voice.src.evaluate_audio_intelligence
```

Inputs:

```
apps/voice/fixtures/audio_intelligence_scenarios.json
```

Output:

```
apps/voice/submission/audio_intelligence_results.json
```

The benchmark compares `raw_noisy`, `aicoustics_only`, and `aicoustics_plus_sentinel` across WER, NISQA-like MOS, SAIS, retry rate, and unsafe action rate.

For the real recorded dataset, SAIS is the safety headline and **correct action rate (SAR)** is the operational stat to raise.

## Real audio dataset benchmark

Recorded clean/noisy command pairs live in:

```
apps/voice/dataset/
  manifest.json
  audio/
    clean/
    noisy/
```

Run the audio-file evaluator:

```bash
python -m apps.voice.src.evaluate_audio_dataset
```

This computes audio stats immediately. WER and SAIS require ASR transcripts. To generate transcripts with Gradium:

```bash
python -m apps.voice.src.evaluate_audio_dataset --transcribe
```

To refresh already cached transcripts after changing prompt or repair logic:

```bash
python -m apps.voice.src.evaluate_audio_dataset --transcribe --force
```

Outputs:

```
apps/voice/submission/audio_dataset_transcripts.json
apps/voice/submission/audio_dataset_results.json
```

Current real-audio benchmark shape:

```
16 clean clips
32 noisy clips
17 supported command cases
```

Current result:

```
Condition  Clips  ASR  WER     SAIS    Unsafe
clean      16     16   0.068   1.000   0.000
noisy      32     32   0.344   1.000   0.000
```

Current correct action / SAR:

```
overall 83.3%
clean   100.0%
noisy   75.0%
```

The evaluator keeps dangerous actions at zero by treating unsupported or too-ambiguous transcripts as safe recoveries. To raise SAR, add conservative repair rules for repeated ASR confusions and collect clearer noisy takes for commands whose transcript no longer contains enough command evidence.

## Files

| File | Purpose |
|---|---|
| `src/agent.py` | LiveKit agent entrypoint, ai-coustics + Gradium pipeline, Gemini reply, dashboard data packets |
| `src/schema.py` | Dataclasses for the full interaction record |
| `src/logger.py` | Appends records to `submission/interactions.json` |
| `src/interpret.py` | Command classifier + failure mode detection |
| `src/audio_capture.py` | Captures raw/enhanced audio snapshots for corpus WAVs |
| `src/nisqa.py` | NISQA scorer for raw vs enhanced audio |
| `src/dispatch_agent.py` | Manual dispatch helper |
| `src/evaluate_audio_intelligence.py` | Scripted SAIS benchmark |
| `src/evaluate_audio_dataset.py` | Real-audio dataset evaluator |
| `fixtures/scenarios.json` | Six staged demo scenarios |
| `submission/interactions.json` | The corpus (grows during demo) |
