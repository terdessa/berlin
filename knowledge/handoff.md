# Handoff

Read `docs/agent-context.md` first, then `docs/person-3-voice-error-logging.md`.

## Current direction

Voice-first retail security copilot. Primary track: telli + ai-coustics. Fallback: Wildcard.

## The differentiator (lock this in before anything else)

The judge wants a rich, structured error corpus he can share with ai-coustics for model improvement. Every voice interaction — success or failure — goes into `submission/interactions.json` alongside the raw and enhanced audio files. The corpus is the deliverable, not just the demo.

## Three layers Person 3 owns

1. **ai-coustics** via the LiveKit Python plugin — cleans guard audio before telli hears it
2. **telli** — multi-turn earpiece conversation with the guard
3. **Intelligence layer** — logs all interactions; produces richly diagnosed failure records with acoustic measurements, conversation history, visual context, failure mode classification, and a natural-language explanation

## Voice runtime decision

Audio path is: guard mic → ai-coustics → telli. No additional voice runtime. This keeps ai-coustics as the single variable in the NISQA before/after metric.

## Demo scenario set (six runs)

| # | Noise | Utterance | Outcome |
|---|---|---|---|
| 1 | Minimal | "open aisle five" | Success |
| 2 | Music | "open aisle five" | Success |
| 3 | Cart + beeps | "send floor associate and create report" | Error: acoustic_confusion |
| 4 | Multi-talker | "replay last ten seconds" | Error: acoustic_residual_noise |
| 5 | Clean | "lock the front door" | Error: out_of_vocabulary |
| 6 | Cut-off | "open aisl—" | Error: incomplete utterance |

## Failure mode classification (key field for ai-coustics)

- `acoustic_residual_noise` — their bottleneck
- `acoustic_confusion` — similar words confused post-enhancement
- `semantic_ambiguity` — not their problem
- `out_of_vocabulary` — not their problem
- `multi_cause` — combination

## Side challenges

- Entire first (push one error record as a review task)
- Aikido if setup is quick

## Implementation stack

Python, LiveKit + livekit/plugins-ai-coustics-python, telli, NISQA v2

## Immediate next step

Confirm ai-coustics credentials + telli SDK access → stand up LiveKit + ai-coustics plugin → run one noisy clip through the pipeline → write first interaction record to `interactions.json`.
