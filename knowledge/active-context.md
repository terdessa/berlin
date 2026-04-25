# Active Context

Sentinel is a **voice-first retail security copilot** for the **telli + ai-coustics** track.

## What we are building

About 20 camera feeds on a dashboard. One highlights red — a Gemini-detected review-worthy event (e.g. shelf-to-pocket movement). The same trigger sends an earpiece alert to the security guard:

> "Aisle 5 requires review. Item appears to move from shelf to pocket."

The guard responds by voice in a noisy supermarket. A multi-turn conversation follows — they can ask for more context, open the clip, dispatch an associate, mark a false alarm, or create a report. ai-coustics cleans the audio; telli handles the conversation.

## Three layers (Person 3 owns all three)

1. **ai-coustics** — audio enhancement: guard mic → ai-coustics → clean audio → telli
2. **telli** — realtime voice I/O: speaks alerts, listens to guard, handles multi-turn dialogue, asks for clarification when unsure
3. **Intelligence layer (our code)** — logs every interaction as a structured record with acoustic measurements, conversation history, visual context, and command interpretation; when recognition fails, produces a richly diagnosed error record

## The track differentiator

The judge confirmed: collecting diverse, contextualised, real-world voice failure data is expensive for ai-coustics. Our intelligence layer turns every session into a data product they can take home.

Every interaction → one JSON record + raw .wav + enhanced .wav, all in `submission/interactions.json`.

Failure records include:
- NISQA v2 scores before and after enhancement (MOS + sub-dimensions)
- Full conversation history (all turns, raw + enhanced transcripts)
- Visual context from Person 2 (Gemini summary, frame, clip)
- Command candidates and confidence
- Failure mode classification (`acoustic_residual_noise`, `acoustic_confusion`, `semantic_ambiguity`, `out_of_vocabulary`)
- Natural-language explanation + suggested clarification question

## Demo runs six staged scenarios

1. Minimal noise — success (baseline)
2. Background music — success (acoustic recovery visible)
3. Cart + beep noise — error, `acoustic_confusion` (floor vs four)
4. Multi-talker babble — error, `acoustic_residual_noise`
5. Clean audio, unsupported command — error, `out_of_vocabulary`
6. Cut-off utterance — graceful incomplete-speech handling

Six records + twelve audio files → self-contained corpus folder handed to judges.

## Implementation path

- Language: Python
- Framework: LiveKit + [livekit/plugins-ai-coustics-python](https://github.com/livekit/plugins-ai-coustics-python)
- Voice runtime: telli
- Audio metric: NISQA v2 (`gabrielmittag/NISQA`)
- No third-party voice runtime on top of telli — keeps ai-coustics as the single variable in the before/after metric

## Side challenge focus

- Entire: push at least one error record as a review task
- Aikido: connect repo and screenshot if setup is quick

## Safety

- Action threshold: 0.7 command confidence. Below that → clarification question, not action.
- Max 3 clarification attempts → error record.
- No irreversible action from low-confidence or out-of-vocab commands.
- All language non-accusatory.

## Next task

Confirm ai-coustics credentials + telli SDK access, then stand up LiveKit + ai-coustics plugin with a hello-world voice agent.
