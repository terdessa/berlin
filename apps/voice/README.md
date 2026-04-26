# Sentinel Voice Service

Person 3 workstream. Python voice agent using LiveKit + ai-coustics + telli.

## Setup

```bash
cd apps/voice
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

If `python3.12` is not installed on your machine, use the available Python 3.12+
interpreter name instead.

## Credentials

Copy `.env.example` at the repo root to `.env` and fill in:

| Variable | Where to get it |
|---|---|
| `AICOUSTICS_API_KEY` | ai-coustics booth / already set |
| `LIVEKIT_URL` | LiveKit dashboard or local server |
| `LIVEKIT_API_KEY` | LiveKit dashboard |
| `LIVEKIT_API_SECRET` | LiveKit dashboard |
| `LIVEKIT_MIC_IDENTITY` | Optional; defaults to `sentinel-guard-mic` |
| `OPENAI_API_KEY` | OpenAI — used for STT/TTS until telli is wired |
| `TELLI_API_KEY` | telli booth |

## Run the agent

```bash
cd apps/voice
source .venv/bin/activate
python -m src.agent dev
```

This starts a LiveKit worker that connects to a room and runs the Sentinel
voice loop with ai-coustics noise cancellation.

## Dispatch the agent into the demo room

The worker must also be dispatched into `sentinel-live`; otherwise it is
registered but not listening in the room.

In a second terminal:

```bash
cd apps/voice
source .venv/bin/activate
python -m src.dispatch_agent
```

You should then see an `agent-...` participant in the LiveKit room.

Open the dashboard at `/` and the mic publisher at `/audio`; by default `/audio` joins as
`sentinel-guard-mic`, which is the participant identity the agent listens to.
Use `/audio?identity=...` only if `LIVEKIT_MIC_IDENTITY` is set to the same
value. Speak a supported guard command such as `open aisle five`; the dashboard
review log should show the Guard transcript, Sentinel response, and final
interaction record.

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

Six scripted scenarios are defined in `fixtures/scenarios.json`.
Run through each one during the demo to populate a diverse corpus.

## Audio intelligence benchmark

The custom judge-facing metric is Sentinel Audio Intelligence Score (SAIS):

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

The benchmark compares `raw_noisy`, `aicoustics_only`, and
`aicoustics_plus_sentinel` across WER, NISQA-like MOS, SAIS, retry rate, and
unsafe action rate.

## Real audio dataset benchmark

Recorded clean/noisy command pairs live in:

```
apps/voice/dataset/
  manifest.json
  audio/
    clean/
    noisy/
```

The dataset manifest maps each clean/noisy pair to the expected command:

```
apps/voice/dataset/manifest.json
```

Run the audio-file evaluator:

```bash
python -m apps.voice.src.evaluate_audio_dataset
```

This computes audio stats immediately. WER and SAIS require ASR transcripts.
To generate transcripts with OpenAI Whisper-compatible transcription:

```bash
OPENAI_API_KEY=... python -m apps.voice.src.evaluate_audio_dataset --transcribe
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

## Architecture

```
guard mic
  └─ ai-coustics (LiveKit plugin, QUAIL_L model)
       └─ telli STT  (currently: OpenAI STT placeholder + Silero VAD)
            └─ interpret.py  (command classifier, ACTION_THRESHOLD=0.7)
                 ├─ confidence ≥ 0.7  →  route command  →  success record → interactions.json
                 └─ confidence < 0.7  →  clarify (max 3 attempts)  →  error record → interactions.json
                      └─ LiveKit data topic `sentinel.voice` → dashboard review log
```

## Files

| File | Purpose |
|---|---|
| `src/schema.py` | Dataclasses for the full interaction record |
| `src/logger.py` | Appends records to `submission/interactions.json` |
| `src/interpret.py` | Command classifier + failure mode detection |
| `src/audio_capture.py` | Captures raw/enhanced audio snapshots for corpus WAVs |
| `src/nisqa.py` | Deterministic NISQA-like scorer used until real NISQA is installed |
| `src/dispatch_agent.py` | Dispatches the registered worker into `sentinel-live` |
| `src/agent.py` | LiveKit agent entrypoint with ai-coustics plugin |
| `fixtures/scenarios.json` | Six staged demo scenarios |
| `submission/interactions.json` | The corpus (grows during demo) |
