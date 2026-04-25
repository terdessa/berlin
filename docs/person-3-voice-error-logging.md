# Person 3: Voice Loop, Audio Intelligence, and Error Corpus

## Responsibility

Own the voice loop, the audio intelligence layer, and the interactions corpus.

This workstream is the track differentiator. Every team on the telli + ai-coustics track will show audio enhancement and a working voice agent. We go further: when the system fails to understand the guard, we produce a diagnostically rich error record that ai-coustics can take back and use as evaluation or training data. The structured corpus we generate during the demo is a data product, not just a log.

## Three Layers

### Layer 1: Audio Enhancement — ai-coustics

The guard speaks in a noisy supermarket. ai-coustics cleans the audio before the voice agent hears it.

Audio path: guard mic → ai-coustics (via LiveKit plugin) → clean audio → telli

Use the official [LiveKit x ai-coustics Python plugin](https://github.com/livekit/plugins-ai-coustics-python).

### Layer 2: Voice I/O — telli

telli drives the realtime conversation:

- Speaks the earpiece alert from the `visual_event`
- Listens to the guard's response (cleaned by ai-coustics)
- Handles multi-turn dialogue (guard can ask for more context, replay, dispatch, etc.)
- Asks for clarification when confidence is low instead of guessing

### Layer 3: Intelligence Layer — our code

Every interaction is logged. Failures get a rich, structured diagnosis. The full session is emitted as `interactions.json` — a data product the judges can share with ai-coustics for model evaluation and improvement.

## Main Goal

Produce an `interactions.json` corpus that:

- Contains one structured record per voice interaction (success or failure)
- For failures, includes acoustic measurements, failure-mode classification, full conversation context, visual context, command candidates, and a natural-language explanation
- Is self-contained: raw and enhanced `.wav` files sit alongside the JSON so the corpus can be shared directly with ai-coustics for evaluation or training

## Interaction Record Schema

### Success record

```json
{
  "id": "interaction-2026-04-25T17:42:09Z-aisle-5",
  "timestamp": "2026-04-25T17:42:09Z",
  "outcome": "success",
  "visualEvent": {
    "id": "event-aisle-5",
    "cameraId": "camera-aisle-5",
    "zone": "Aisle 5",
    "summary": "Item appears to move from shelf to pocket. Human review recommended.",
    "confidence": 0.82,
    "frameUrl": "frames/aisle-5-alert.jpg",
    "clipUrl": "clips/aisle-5-event.mp4"
  },
  "audio": {
    "rawClipPath": "audio/raw/2026-04-25T17-42-09.wav",
    "enhancedClipPath": "audio/enhanced/2026-04-25T17-42-09.wav",
    "nisqa": {
      "raw":      { "mos": 2.1, "noisiness": 1.8, "coloration": 2.4, "discontinuity": 2.6, "loudness": 3.0 },
      "enhanced": { "mos": 3.7, "noisiness": 3.8, "coloration": 3.6, "discontinuity": 3.9, "loudness": 3.8 },
      "delta":    { "mos": 1.6 }
    }
  },
  "conversation": [
    { "speaker": "assistant", "text": "Aisle 5 requires review. Item appears to move from shelf to pocket." },
    { "speaker": "guard", "rawTranscript": "open all five", "enhancedTranscript": "open aisle five", "asrConfidence": 0.91 }
  ],
  "interpretation": {
    "interpretedCommand": "open_camera",
    "targetCameraId": "camera-aisle-5",
    "commandConfidence": 0.91,
    "candidates": [
      { "command": "open_camera", "confidence": 0.91 },
      { "command": "watch_live",  "confidence": 0.07 }
    ]
  },
  "failure": null,
  "actionTaken": "opened_evidence_video",
  "humanCorrection": null
}
```

### Failure record

Same shape as success, with `failure` populated:

```json
{
  "id": "interaction-2026-04-25T17:45:33Z-aisle-5",
  "timestamp": "2026-04-25T17:45:33Z",
  "outcome": "error",
  "visualEvent": { "...": "same fields as above" },
  "audio": {
    "rawClipPath": "audio/raw/2026-04-25T17-45-33.wav",
    "enhancedClipPath": "audio/enhanced/2026-04-25T17-45-33.wav",
    "nisqa": {
      "raw":      { "mos": 1.9, "noisiness": 1.6, "coloration": 2.2, "discontinuity": 2.5, "loudness": 2.9 },
      "enhanced": { "mos": 2.8, "noisiness": 2.6, "coloration": 3.0, "discontinuity": 3.1, "loudness": 3.3 },
      "delta":    { "mos": 0.9 }
    }
  },
  "conversation": [
    { "speaker": "assistant", "text": "Aisle 5 requires review. Item appears to move from shelf to pocket." },
    { "speaker": "guard", "rawTranscript": "send floor something report", "enhancedTranscript": "send floor associate and create report", "asrConfidence": 0.61 },
    { "speaker": "assistant", "text": "Did you mean send a floor associate to aisle five and create a report?" },
    { "speaker": "guard", "rawTranscript": "yes do it", "enhancedTranscript": "yes do it", "asrConfidence": 0.95 }
  ],
  "interpretation": {
    "interpretedCommand": "send_floor_associate",
    "targetCameraId": "camera-aisle-5",
    "commandConfidence": 0.54,
    "candidates": [
      { "command": "send_floor_associate", "confidence": 0.54 },
      { "command": "create_report",        "confidence": 0.41 },
      { "command": "unknown",              "confidence": 0.18 }
    ]
  },
  "failure": {
    "failureMode": "acoustic_confusion",
    "reason": "voice_command_unclear",
    "acousticNote": "Enhanced NISQA improved by 0.9 MOS but partial recovery only. 'floor' and 'four' remain acoustically similar at this noise level.",
    "explanation": "After enhancement the guard's audio partially recovered but residual noise made 'floor' and 'four' acoustically indistinguishable. Visual context (dispatch scenario, aisle 5) raises belief in send_floor_associate but not above the action threshold (0.7). The system asked for clarification rather than acting.",
    "suggestedClarification": "Did you mean send a floor associate to aisle five and create a report?",
    "expectedCommand": "send_floor_associate"
  },
  "actionTaken": "asked_for_clarification",
  "humanCorrection": "send_floor_associate_and_create_report"
}
```

## Failure Mode Classification

Every failure record gets one of these values in `failure.failureMode`. This field lets ai-coustics filter the corpus to failures where their model is the bottleneck.

- `acoustic_residual_noise` — NISQA enhanced score still low; ai-coustics did not recover enough. **Their model bottleneck.**
- `acoustic_confusion` — enhanced audio is clean but acoustically similar words were confused. **Interesting case for ai-coustics.**
- `semantic_ambiguity` — audio clean and words clear, but utterance maps to multiple valid commands. Not an ai-coustics problem.
- `out_of_vocabulary` — audio clean, words clear, but no supported command matches. Not an ai-coustics problem.
- `multi_cause` — combination of the above.

## Staged Demo Scenarios

Run at least these six scenarios to produce a diverse, useful corpus.

| # | Noise type | Utterance | Expected outcome | Failure mode |
|---|---|---|---|---|
| 1 | Minimal (baseline) | "open aisle five" | Success | — |
| 2 | Background music | "open aisle five" | Success | — |
| 3 | Cart + checkout beeps | "send floor associate and create report" | Error | `acoustic_confusion` |
| 4 | Multi-talker babble | "replay last ten seconds" | Error | `acoustic_residual_noise` |
| 5 | Clean audio | "lock the front door" | Error | `out_of_vocabulary` |
| 6 | Partial utterance (cut off) | "open aisl—" | Error | graceful incomplete-speech handling |

Each scenario produces one JSON record plus two audio files (raw + enhanced `.wav`).

## Conversation Model

Each interaction is multi-turn. The `conversation` array holds ordered turns:

```json
{ "speaker": "assistant", "text": "..." }
{ "speaker": "guard", "rawTranscript": "...", "enhancedTranscript": "...", "asrConfidence": 0.0 }
```

When confidence is below the action threshold (0.7), the assistant asks a clarification question rather than acting. The exchange continues until:

- Confidence passes 0.7 → action taken, success record written.
- Three clarification attempts exhausted → error record written with `reason: "max_clarifications_reached"`.

## Supported Commands

- `open_camera`
- `watch_live`
- `replay_last_10_seconds`
- `send_floor_associate`
- `mark_false_alarm`
- `create_report`

Anything outside this set triggers `out_of_vocabulary`. No irreversible action is taken.

## Deliverable: Corpus Folder

The final submission includes:

```
submission/
  interactions.json         ← all interaction records, one object per turn
  audio/
    raw/                    ← raw .wav files, named by timestamp
    enhanced/               ← ai-coustics enhanced .wav files
  frames/                   ← Gemini frame references from Person 2
  clips/                    ← video clip references from Person 2
```

This folder is self-contained and can be handed directly to ai-coustics for evaluation or model improvement without any additional tooling.

## Audio Intelligence Metric (track requirement)

Primary metric: isolated before/after ai-coustics comparison on the same telli pipeline.

- **Without ai-coustics:** noisy mic → telli → transcript + command confidence
- **With ai-coustics:** noisy mic → ai-coustics → telli → transcript + command confidence

The difference is captured in every `audio.nisqa` block. Aggregate across the corpus to show:

- Mean NISQA MOS improvement across all scenarios
- Command recognition accuracy with vs. without enhancement
- Task completion rate (successful action taken) with vs. without enhancement

**Scoring tool:** NISQA v2 (gabrielmittag/NISQA) — PyTorch, non-intrusive MOS prediction, no clean reference signal needed. Outputs MOS plus four sub-dimensions: noisiness, coloration, discontinuity, loudness.

## Implementation Stack

- Language: Python
- Voice framework: LiveKit with [livekit/plugins-ai-coustics-python](https://github.com/livekit/plugins-ai-coustics-python)
- Voice runtime: telli
- Audio scoring: NISQA v2
- Side challenge: Entire — push at least one review/error record as an Entire task

## Inputs From Person 2

- `visual_event.id`, `cameraId`, `zone`, `summary`, `clipUrl`, `frameUrl`, `confidence`
- Embedded in every interaction record and used in the failure explanation

## Outputs To Person 1

- Earpiece alert text (for the alert transcript panel)
- Raw and enhanced transcript per guard turn (for the before/after transcript panel)
- Interpreted command + confidence (for the confidence display)
- Full interaction record (for the review/error report panel)
- Path to `interactions.json` corpus (for the metric dashboard)

## Entire Integration

Push at least one review/error record to Entire as a task:

```json
{
  "title": "Aisle 5 camera requires review",
  "cameraId": "camera-aisle-5",
  "zone": "Aisle 5",
  "visualSummary": "Item appears to move from shelf to pocket. Human review recommended.",
  "enhancedTranscript": "send floor associate and create report",
  "interpretedCommand": "send_floor_associate",
  "confidence": 0.54,
  "failureMode": "acoustic_confusion",
  "actionTaken": "asked_for_clarification"
}
```

## Safety Requirements

- Command confidence below 0.7 → ask for clarification or write error record. Never act on a low-confidence command.
- No irreversible action from out-of-vocabulary commands.
- All language in reports is non-accusatory. Error reports debug the system, not the guard.
- `explanation` fields describe acoustic and semantic conditions, not people.

## Integration Checkpoints

1. LiveKit + ai-coustics plugin processes one noisy clip locally.
2. NISQA scores a raw and enhanced pair and the result appears in the interaction record.
3. One staged scenario produces a complete record in `interactions.json`.
4. All six scenarios produce records; corpus folder is self-contained with audio files.
5. One Entire task created from a failure record.
6. Person 1 frontend displays the interaction record correctly.
