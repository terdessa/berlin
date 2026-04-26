# Sentinel Voice Service

Python voice agent using LiveKit + ai-coustics + Gradium.

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
| `LIVEKIT_URL` | LiveKit dashboard or local server |
| `LIVEKIT_API_KEY` | LiveKit dashboard |
| `LIVEKIT_API_SECRET` | LiveKit dashboard |
| `LIVEKIT_MIC_IDENTITY` | Optional; defaults to `sentinel-guard-mic` |
| `GRADIUM_API_KEY` | Gradium voice runtime |

The ai-coustics SDK key is configured inside LiveKit Cloud (project → ai-coustics integration). The LiveKit room token and server URL are forwarded to the plugin at runtime — there is no local ai-coustics env var.

## Run the agent

```bash
cd apps/voice
source .venv/bin/activate
python -m src.agent dev
```

This starts a LiveKit worker that registers and waits for a dispatch.

## Dispatch the agent into the demo room

In a second terminal, dispatch the worker into `sentinel-live`:

```bash
cd apps/voice
source .venv/bin/activate
python -m src.dispatch_agent
```

The script is idempotent — if a dispatch already exists for `sentinel-live`, it prints the existing IDs and exits without creating a duplicate. Useful flags:

- `python -m src.dispatch_agent --status` — show active dispatches and participants.
- `python -m src.dispatch_agent --reset` — delete every active dispatch and `agent-*` participant in the room, then create one fresh dispatch (recovery for stale state).

Once dispatched you should see an `agent-…` participant in the LiveKit room.

## Walkie-talkie path

Open the dashboard at `/`. The "hold to talk" button in the dashboard header opens the laptop microphone and publishes audio into the LiveKit room as identity `sentinel-guard-mic` (the identity the agent listens to; override with `LIVEKIT_MIC_IDENTITY`).

Hold the talk button, speak naturally:

```
laptop mic → ai-coustics enhancement → Gradium STT → Gemini 2.5 Flash Lite
       (with active visual event + last frame attached) → Gradium TTS → dashboard speaker
```

When CAM-03 detects a palm, the dashboard publishes a `sentinel.visual-alert` packet that includes a small JPEG of the scene (presented to the guard as an "item appears taken from shelf" event). The agent caches that frame; any follow-up question from the guard ("what is happening", "what do you see", "is the customer still there?") goes to Gemini together with the frame, so it can describe the actual scene rather than guessing from the summary text. The dashboard review log shows the Guard transcript, Sentinel response, and final interaction record.

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
To generate transcripts with Gradium:

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

## Architecture

```
guard mic
  └─ ai-coustics (LiveKit plugin, QUAIL_L model)
       └─ Gradium STT
            ├─ Gemini 2.5 Flash Lite chat (system prompt + visual context + history)
            │    └─ Gradium TTS  →  spoken reply on the LiveKit room
            └─ interpret.py  (regex command classifier, ACTION_THRESHOLD=0.7)
                 ├─ confidence ≥ 0.7  →  success record → interactions.json
                 └─ confidence < 0.7  →  failure record (clarification or max-clarifications)
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
