# Sentinel Demo Plan

## Goal

Prove Sentinel is a real-time voice interface that works in noisy retail environments — and that its failure-handling produces a structured corpus the ai-coustics team can use as evaluation or training data.

## Demo Flow

1. Show the dashboard at `/` on a laptop — eight camera feeds, with CAM-03 wired to the laptop webcam and analysed live by Gemini in 5-frame bursts.
2. Open `/voice` on a phone and accept the cert. Press the big mic button to confirm the walkie-talkie is online.
3. Pick up an object in front of CAM-03. Gemini's `object-hold` detector returns `HOLD` and the dashboard publishes a single visual alert (one alert per dashboard page-load).
4. Sentinel speaks the alert through the phone:
   - "Alert. An item appears taken from shelf on CAM-03."
5. Guard responds over the phone mic:
   - "What do you see?"
6. ai-coustics enhances the audio inside LiveKit Cloud (raw vs enhanced NISQA visible in the corpus).
7. Voice layer transcribes (Gradium) and Gemini replies using the cached CAM-03 frame:
   - "A person in a dark hoodie picked up a small box from the left shelf and is holding it in their right hand."
8. Guard issues an action command:
   - "Send floor associate and create report."
9. Sentinel acts and writes the interaction record.
10. A deliberately ambiguous follow-up command produces an error record with classification, explanation, and a suggested clarification — instead of a risky action.
11. Run the rest of the scripted scenario set so the corpus has varied data, then show the resulting `apps/voice/submission/interactions.json` and the per-scenario NISQA / recognition table.

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

Every interaction record includes:

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

Primary: SAIS, shown across raw audio, ai-coustics-enhanced audio, and ai-coustics plus Sentinel context validation.

Secondary: dangerous error rate, WER, NISQA/DNSMOS uplift, and retry/safe recovery rate.

Both metrics are computed from `interactions.json` so the judges can reproduce them from the corpus alone.

## Final Submission Artifact

An `apps/voice/submission/` folder containing:

- `interactions.json` — the corpus
- `audio/raw/` and `audio/enhanced/` — paired audio files referenced by the corpus
- `frames/` and `clips/` — the visual context referenced by the corpus
- audio intelligence result JSON files for the reproducible benchmark

This is what we hand to the ai-coustics team after the demo.

## Demo Rule

Keep language non-accusatory. The system flags review-worthy observable behavior; it does not decide that theft happened. The agent describes what's in the camera frame directly and only escalates to "human review recommended" when the guard asks something the camera can't answer.
