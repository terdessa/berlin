# Sentinel Demo Plan

## Goal

Prove Sentinel is a real-time voice interface that works in noisy retail environments — and that its failure-handling produces a structured corpus the ai-coustics team can use as evaluation or training data.

## Demo Flow

1. Show a supermarket dashboard with many camera feeds.
2. One analyzed feed shows a staged review-worthy event, such as shelf-to-pocket movement.
3. Sentinel flags the camera.
4. Sentinel speaks an earpiece alert:
   - "Aisle 5 requires review. Item appears to move from shelf to pocket."
5. Guard responds over noisy store audio:
   - "Open aisle five."
6. ai-coustics enhances the audio (live NISQA score visible: raw vs enhanced).
7. Voice layer interprets the command.
8. Sentinel opens the relevant evidence video.
9. Guard asks for context, gets a non-accusatory summary, then issues:
   - "Send floor associate and create report."
10. Sentinel acts and writes the interaction record.
11. A deliberately ambiguous follow-up command produces an error record with classification, explanation, and a suggested clarification — instead of a risky action.
12. Run the rest of the scripted scenario set so the corpus has varied data, then show the resulting `submission/interactions.json` and the per-scenario NISQA / recognition table.

## Scenario Set (Drives The Corpus)

At least six scripted scenarios so the corpus looks like a dataset rather than one demo clip:

1. Clean `open_aisle_five` — baseline success.
2. Music-heavy `open_aisle_five` — acoustic recovery success.
3. Cart and beep noise `send_floor_associate_and_create_report` — acoustic confusion failure (floor vs four).
4. Multi-talker babble `replay_last_ten_seconds` — acoustic residual noise.
5. Clean `lock_the_front_door` — out-of-vocabulary failure; proves no wrong action on clean clear audio.
6. Cut-off `open_aisl-` — partial utterance edge case.

## Required Screens

- Camera grid or shop floor plan
- Highlighted alert camera
- Video/evidence panel
- Earpiece alert transcript
- Raw vs enhanced guard transcript
- Live NISQA score for raw and enhanced audio
- Command interpretation, confidence, and candidates considered
- Per-scenario summary table sourced from `interactions.json`
- The latest interaction record — success or richly diagnosed failure

## Interaction Record Contents

See `docs/person-3-voice-error-logging.md` for the full schema. Every record includes:

- triggering video clip and frame
- camera ID and store zone
- visual scene summary and confidence
- assistant message
- raw audio and enhanced audio (file paths)
- NISQA scores for raw and enhanced (MOS plus four sub-dimensions)
- noise tag and estimated SNR
- raw and enhanced transcripts
- interpreted command, command candidates, confidence
- failure classification (acoustic_residual_noise / acoustic_confusion / semantic_ambiguity / out_of_vocabulary / multi_cause), if applicable
- natural-language explanation and suggested clarification
- action taken
- final human correction, if any

## Track Metric

Primary: NISQA MOS uplift from raw to enhanced, averaged across the scenario set, with per-scenario breakdown.

Secondary: command recognition rate with vs without ai-coustics on the same scenario set.

Both metrics are computed from `interactions.json` so the judges can reproduce them from the corpus alone.

## Final Submission Artifact

A `submission/` folder containing:

- `interactions.json` — the corpus
- `audio/raw/` and `audio/enhanced/` — paired audio files referenced by the corpus
- `frames/` and `clips/` — the visual context referenced by the corpus
- a short `README.md` explaining the failure-mode classifications

This is what we hand to the ai-coustics team after the demo.

## Demo Rule

Keep language non-accusatory. The system flags review-worthy observable behavior; it does not decide that theft happened.
