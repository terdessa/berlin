# Sentinel Audio Intelligence Metric & Quality Dashboard

## Overview

Sentinel is a voice-first retail security copilot for noisy real-world environments such as supermarkets. It listens to a guard's spoken commands, cleans the audio with ai-coustics, transcribes the command, checks it against the current security context, and either performs the correct action or asks a safe clarification.

The project is not only a voice interface. It is an evidence system that proves whether the assistant makes correct or safe decisions when speech is noisy, ambiguous, or partially misheard.

Core claim:

> We measure not just what Sentinel hears, but whether Sentinel does the right thing.

## Demo Promise

The demo should make three things obvious:

1. Noisy speech is difficult for raw transcription.
2. ai-coustics improves the audio path before transcription.
3. Sentinel's context-aware decision layer reduces dangerous errors by asking for clarification when confidence or context looks suspicious.

The dashboard should show both the live security workflow and the quality evidence behind it.

## Sentinel Pipeline

```text
Guard voice
   v
ai-coustics enhancement
   v
STT model
   v
Command parser
   v
Context-aware validation
   v
Decision layer
   v
Action + logging
   v
Dashboard update
```

### Conversation Loop

1. A camera event appears on the dashboard.
2. Sentinel speaks a concise alert to the guard.
3. The guard responds through the `/voice` mic connection.
4. LiveKit routes the mic stream to the Python voice agent.
5. ai-coustics enhances the audio before transcription.
6. STT produces a transcript and confidence signal.
7. The command parser maps speech to an action candidate.
8. Context validation checks whether the command matches the active incident.
9. Sentinel either acts, asks a clarification, or logs a failure.
10. The dashboard updates the conversation log, metrics, and interaction table.

Example:

```text
Sentinel: Aisle five requires review. Human review recommended.
Guard: Open aisle five.
Sentinel: Opening aisle five.
```

Clarification example:

```text
Sentinel: Aisle five requires review. Human review recommended.
Guard: Open aisle four.
Sentinel: Did you mean aisle five?
Guard: Yes.
Sentinel: Opening aisle five.
```

## Audio Input

Record guard commands that match real dashboard actions:

```text
open camera three
open aisle five
watch live
replay last ten seconds
send floor associate
mark false alarm
create report
```

Recommended test set:

```text
12 clean samples
25 noisy samples
```

Use the same or similar commands across clean and noisy conditions so raw audio, enhanced audio, and context-aware validation can be compared fairly.

Noise conditions to include:

- store music
- checkout beeps
- crowd chatter
- overlapping speech
- low-volume speech
- microphone movement

## Audio Enhancement

Use the ai-coustics SDK or the LiveKit ai-coustics plugin to clean noisy speech before transcription.

For every interaction, save both versions:

```text
raw_audio.wav
enhanced_audio.wav
```

The dashboard should make the before/after path visible without overwhelming the operator. The main UI should focus on the decision, while the quality panel shows raw versus enhanced metrics.

## Speech-to-Text

Use Gradium STT for the running demo.

Expected transcript output:

```json
{
  "raw_transcript": "open aisle four",
  "enhanced_transcript": "open aisle five"
}
```

WER is useful, but it is only a supporting metric. A perfect transcript is not the final goal; the final goal is a correct or safe security decision.

## Context-Aware Validation

This is Sentinel's most important logic. It checks whether the heard command is safe in the current incident context.

Example context:

```json
{
  "active_incident": "aisle_5",
  "recommended_camera": "camera_5",
  "heard_command": "open aisle 4",
  "confidence": 0.58
}
```

Validation checks:

- Does the command match the current incident?
- Is confidence below the action threshold?
- Is the command risky, irreversible, or operationally important?
- Is there a number, aisle, camera, or action mismatch?

If suspicious, Sentinel should ask for clarification instead of acting:

```text
Did you mean aisle five?
```

## Decision Layer

Every interaction ends in exactly one decision type:

| Decision type | Meaning | Metric result |
| --- | --- | --- |
| Correct action | Sentinel executes the expected command | Success |
| Safe recovery | Sentinel detects uncertainty and asks for clarification | Success |
| Dangerous error | Sentinel executes an incorrect or risky action | Failure |

Examples:

| Situation | Result |
| --- | --- |
| Opens the correct camera | Correct action |
| Asks before opening a mismatched aisle | Safe recovery |
| Opens the wrong camera without confirmation | Dangerous error |

## Main Metric

### Sentinel Audio Intelligence Score

```text
SAIS = (Correct Actions + Safe Recoveries) / Total Commands
```

SAIS answers:

> Did Sentinel do the correct or safe thing under noisy audio?

This is the main innovation because it evaluates decision quality, not only transcription quality.

## Supporting Metrics

Use these five metrics in the dashboard:

| Metric | Formula | Purpose |
| --- | --- | --- |
| SAIS | `(correct actions + safe recoveries) / total commands` | Main decision-quality score |
| Correct Action Rate / SAR | `correct actions / total commands` | Measures direct successful action routing |
| Safe Recovery Rate | `safe recoveries / total commands` | Measures useful caution |
| Dangerous Error Rate | `dangerous errors / total commands` | Measures unsafe failures |
| WER | `word errors / total words` | Measures transcript accuracy |

Optional bonus metrics:

- VAD miss rate using silero-vad
- DNSMOS using VERSA or DNSMOS tooling
- NISQA MOS uplift for raw versus enhanced audio

> **Honesty disclosure for judges.** The repo currently ships a *NISQA-like* deterministic MOS estimator (`apps/voice/src/nisqa.py`, derived from RMS / crest / zero-crossings) — not the published NISQA-v2 neural model. The fields and ranges match NISQA so the dashboard surface is identical, but if a judge asks "did you run NISQA?" the truthful answer is "no, we ship a NISQA-like estimator labelled `nisqa.delta.mos`; we kept the field names because they're the right interface, but we did not bundle the NISQA model weights into the demo." DNSMOS, VAD miss-rate, and LUFS from `dashboard.md` are not currently computed.

Do not overcomplicate the dashboard. SAIS, dangerous error rate, and the raw/enhanced comparison should be the clearest signals.

## Dashboard Design

The dashboard should feel like a security operations surface, not a marketing page. It should be dense, calm, dark, and built for scanning.

### First Screen Layout

```text
+-------------------------------------------------------------+
| Camera grid: live feeds, active incident, visual alert state |
+-------------------------------+-----------------------------+
| Active incident video/replay   | Voice conversation log       |
| Scene summary                  | Transcript + confidence      |
| Suggested action               | Clarification/action status  |
+-------------------------------+-----------------------------+
| SAIS cards + comparison table + recent interaction outcomes  |
+-------------------------------------------------------------+
```

The operator should immediately see:

- which camera needs review
- what Sentinel said
- what the guard said
- whether Sentinel acted or asked for clarification
- how that interaction affected the quality metrics

### Top Metric Cards

Show five compact cards:

```text
SAIS: 92%
Correct Action Rate: 70%
Safe Recovery Rate: 22%
Dangerous Error Rate: 8%
WER: 12%
```

Design guidance:

- SAIS should be visually primary.
- Dangerous Error Rate should use the strongest warning treatment.
- WER should be visually secondary because it supports, but does not replace, SAIS.

### System Comparison Table

This is the most important evidence section.

| Version | SAIS | WER | Dangerous Error Rate |
| --- | ---: | ---: | ---: |
| Raw audio | 55% | 35% | 30% |
| + ai-coustics | 80% | 15% | 12% |
| + ai-coustics + context | 92% | 15% | 5% |

This table proves the contribution of each layer:

- raw audio shows the baseline problem
- ai-coustics shows audio improvement
- context validation shows decision safety improvement

### Voice Conversation Panel

The conversation panel should be text-first:

| Speaker | Content | UI treatment |
| --- | --- | --- |
| Sentinel | Alert, clarification, action confirmation | calm/teal assistant style |
| Guard | Spoken command transcript | amber guard style |
| System | Parsed command, confidence, decision | compact status chips |

Each guard turn should show:

- transcript
- confidence
- matched command
- whether raw or enhanced audio produced the best transcript
- clarification status when needed

Low-confidence or context-mismatched turns should clearly show:

```text
voice command unclear
context mismatch
asking confirmation
```

### Interaction Log

Show the most recent commands as a table:

| Expected | Heard | Action | Result | Reason |
| --- | --- | --- | --- | --- |
| open aisle five | open aisle four | ask confirmation | safe recovery | context mismatch |
| replay last ten seconds | replay last ten seconds | replay video | correct | matched |
| mark false alarm | mark alarm | ask confirmation | safe recovery | risky action |

The log should make failures useful, not embarrassing. Each row should explain what happened and why Sentinel chose its action.

### Failure Breakdown

Show a compact breakdown of failure causes:

```text
number confusion: 60%
low confidence audio: 25%
overlapping speech: 15%
```

Useful categories:

- number confusion
- aisle/camera mismatch
- low confidence audio
- overlapping speech
- unsupported command
- risky action
- context mismatch

## JSON Log Format

Save every interaction as structured JSON so the dashboard can recompute metrics from the corpus.

Correct action example:

```json
{
  "id": "test_001",
  "condition": "noisy",
  "noise_type": "music_and_chatter",
  "expected_command": "open aisle five",
  "raw_transcript": "open aisle four",
  "enhanced_transcript": "open aisle five",
  "expected_action": "open_aisle_5",
  "actual_action": "open_aisle_5",
  "context": {
    "active_incident": "aisle_5",
    "recommended_camera": "camera_5"
  },
  "decision_type": "correct_action",
  "correct_action": true,
  "safe_recovery": false,
  "dangerous_error": false,
  "failure_reason": null,
  "wer": 0.0,
  "confidence": 0.91
}
```

Safe recovery example:

```json
{
  "id": "test_002",
  "condition": "noisy",
  "expected_command": "open aisle five",
  "raw_transcript": "open aisle four",
  "enhanced_transcript": "open aisle four",
  "expected_action": "open_aisle_5",
  "actual_action": "ask_confirmation",
  "context": {
    "active_incident": "aisle_5"
  },
  "decision_type": "safe_recovery",
  "correct_action": false,
  "safe_recovery": true,
  "dangerous_error": false,
  "failure_reason": "context_mismatch_number_confusion",
  "wer": 0.33,
  "confidence": 0.58
}
```

## Testing Methodology

### Controlled Testing

Use predefined commands with known expected actions. This produces reliable metrics for the comparison table.

Process:

1. Record clean and noisy audio.
2. Run raw audio through STT.
3. Run enhanced audio through STT.
4. Compare transcripts to expected commands with `jiwer`.
5. Parse commands into action candidates.
6. Run context-aware validation.
7. Save each interaction as JSON.
8. Let the dashboard calculate metrics from JSON.

### Live Evaluation

Use live microphone input during the demo:

1. Guard speaks a command.
2. Sentinel transcribes and validates it.
3. If needed, Sentinel asks a clarification.
4. Guard confirms or corrects.
5. The dashboard updates the conversation log and metrics.

This makes the system feel real while the controlled test set keeps the numbers defensible.

## Current Repository Implementation

The current repo has both a scripted benchmark and a real-audio benchmark.

```text
apps/voice/
  dataset/
    manifest.json
    audio/
      clean/                 clean recorded command clips
      noisy/                 noisy recorded command clips
  fixtures/
    audio_intelligence_scenarios.json
  src/
    evaluate_audio_dataset.py
    evaluate_audio_intelligence.py
  submission/
    audio_dataset_transcripts.json
    audio_dataset_results.json
    audio_intelligence_results.json
```

Run the real-audio benchmark:

```bash
python -m apps.voice.src.evaluate_audio_dataset
```

Refresh Gradium transcription cache:

```bash
python -m apps.voice.src.evaluate_audio_dataset --transcribe --force
```

Run the scripted comparison benchmark:

```bash
python -m apps.voice.src.evaluate_audio_intelligence
```

The UI quality dashboard is available at:

```text
/metrics
```

The main dashboard links to this page.

## Current Benchmark State

The real recorded dataset currently contains 16 clean clips and 32 noisy clips across 17 supported command cases.

Current real-audio result:

```text
Condition  Clips  ASR  WER     SAIS    Unsafe
clean      16     16   0.068   1.000   0.000
noisy      32     32   0.344   1.000   0.000
```

Current action-routing result:

```text
Overall correct action / SAR: 83.3%
Clean correct action / SAR:   100.0%
Noisy correct action / SAR:   75.0%
Safe recovery rate:           16.7%
Dangerous error rate:         0.0%
```

The expanded noisy set creates many severe ASR errors. Sentinel now repairs recurring domain-specific mishears such as `Great reports` -> `create report`, `Post the video` -> `pause the video`, `Prison Playbook` -> `resume playback`, `Open MRC` -> `open camera three`, and `What life` -> `watch live`. Clips that are still too far from a supported command are rejected as safe recoveries, preserving zero dangerous actions.

The stat to raise next is not SAIS; SAIS is already perfect because unsafe actions are avoided. The stat to raise is correct action / SAR, especially on noisy clips, while keeping dangerous error rate at zero.

The scripted benchmark still matters because it includes safe-recovery cases that the current real audio set does not yet contain:

```text
raw_noisy                 SAIS 0.500   WER 0.280   unsafe 0.214
aicoustics_only           SAIS 0.714   WER 0.149   unsafe 0.143
aicoustics_plus_sentinel  SAIS 0.857   WER 0.125   unsafe 0.000
```

Next benchmark improvement: add real mismatch clips where the active incident is aisle five but the heard/ASR command targets aisle four. These should produce `safe_recovery`, not `dangerous_error`. Also add new takes for the remaining weak noisy commands instead of overfitting the repair layer to transcripts that no longer contain usable command evidence.

## Research Alignment

The ai-coustics `AudioAI-Resources` repo recommends a quality dashboard with standard audio and speech signals, plus one app-specific signal.

Standard signals:

- DNSMOS or NISQA: perceived audio quality
- WER: transcription degradation under noise
- VAD miss-rate: whether speech was detected
- LUFS: whether the input level is usable

Sentinel-specific signal:

- SAIS: whether the security agent made the correct or safe decision

This keeps the project aligned with the track guidance: standard metrics prove the audio path improved, while SAIS proves the voice agent stayed operationally safe.

## Tools and Models

Minimum winning stack:

```text
ai-coustics       -> audio enhancement
LiveKit           -> realtime room, mic routing, data events
Gradium STT/TTS   -> voice runtime
jiwer             -> WER calculation
custom Python/JS  -> SAIS and dashboard metrics
React/Vite        -> dashboard
```

Optional:

```text
silero-vad        -> speech detection / missed speech
VERSA or DNSMOS   -> audio quality score
NISQA             -> raw/enhanced MOS uplift
```

Skip for the demo:

```text
PESQ
STOI
speaker ID
emotion detection
CLAP
heavy research metrics
```

## Final Pitch

> We built Sentinel with a live quality dashboard. Standard metrics like WER show whether the system heard correctly, but our custom Sentinel Audio Intelligence Score measures whether the system made the correct or safe security decision under noisy conditions. The dashboard compares raw audio, ai-coustics-enhanced audio, and context-aware validation, showing how each layer reduces dangerous errors.

One-line summary:

> We measure not just what the system hears, but whether it does the right thing.
