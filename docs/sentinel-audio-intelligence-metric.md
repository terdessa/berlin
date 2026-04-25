# Sentinel Audio Intelligence Metric & Quality Dashboard

## 🧠 Overview

Sentinel is a voice-first retail security copilot designed for **noisy real-world environments** (e.g. supermarkets).

The goal is not just to build a voice interface, but to **prove with measurable evidence** that the system works under challenging audio conditions.

We combine:
- Standard audio metrics (WER, MOS, etc.)
- A custom **Audio Intelligence Metric** focused on decision-making
- A live-updating evaluation loop

---

## 🎯 Core Idea

> **We measure not just whether the system hears correctly, but whether it makes the correct or safe decision under noisy conditions.**

---

## 🧠 Sentinel Audio Intelligence Metric (SAIS)

### Definition

> **SAIS measures how often Sentinel performs the correct or safe action from voice input, using context-aware validation and live confirmation.**

---

### Formula
SAIS = (Correct Actions + Safe Recoveries) / Total Commands

---

### What counts as success?

| Case | Description | Result |
|------|------------|--------|
| ✅ Correct Action | System executes correct command | Success |
| ✅ Safe Recovery | System detects uncertainty and asks for clarification | Success |
| ❌ Dangerous Error | System executes incorrect or risky action | Failure |

---

## 📊 Supporting Metrics

### 1. Correct Action Rate
Correct Action Rate = Correct Actions / Total Commands

---

### 2. Safe Recovery Rate
Safe Recovery Rate = Clarifications / Total Commands

---

### 3. Dangerous Error Rate
Dangerous Error Rate = Wrong Risky Actions / Total Commands

---

### 4. Word Error Rate (WER)
Measures transcription accuracy:
WER = Word Errors / Total Words

Used as a **supporting metric**, not the main one.

---

## 🔥 What makes this metric innovative?

### 1. Focus on decisions, not words
- WER measures transcription
- SAIS measures **real-world success**

---

### 2. Includes safe behavior
- Asking for clarification counts as success
- Prevents dangerous mistakes

---

### 3. Context-aware validation
Example:

- Context: Incident at aisle 4
- Transcript: "Open aisle 5"

Sentinel:
> "Did you mean aisle 4?"

---

### 4. Live metric updates

Sentinel continuously updates metrics using:
- User confirmations
- Context mismatch detection
- Real interaction feedback

---

## 🔄 Live Evaluation Loop

1. User speaks
2. System transcribes
3. Context is checked
4. If suspicious → ask clarification
5. User confirms
6. System logs:
   - Correct / safe / wrong
   - WER update
   - Failure reason
7. Dashboard updates in real-time

---

## 📦 Data Logging Format (JSON)

Each interaction is logged:

```json
{
  "command_expected": "open aisle 4",
  "transcript": "open aisle 5",
  "action_expected": "open_aisle_4",
  "action_actual": "open_aisle_5",
  "correct": false,
  "safe_recovery": true,
  "failure_reason": "number_confusion",
  "confidence": 0.62
}
```

📊 Dashboard Design
🔹 Section 1 — Summary
Sentinel Intelligence Score: 92%
Correct Action Rate: 70%
Safe Recovery Rate: 22%
Dangerous Error Rate: 8%
WER: 12%
🔹 Section 2 — System Comparison
System Version	Intelligence Score	WER	Dangerous Errors
Raw audio	55%	35%	30%
+ ai-coustics	80%	15%	12%
+ context	92%	15%	5%
🔹 Section 3 — Interaction Log
Command	Heard	Action	Result	Reason
open aisle 5	aisle 4	open 4	❌	number confusion
open aisle 5	aisle 4	ask confirm	✅	context mismatch
🔹 Section 4 — Failure Breakdown
60% number confusion
25% noise
15% overlapping speech
🧪 Testing Methodology
Dataset
30–50 voice commands
Split:
~10 quiet
~20–30 noisy
Conditions Tested
Background noise (music, chatter)
Overlapping speech
Low confidence audio
Evaluation Types
1. Controlled Testing
Predefined commands
Known expected actions
Used for reliable metrics
2. Live Evaluation
Real-time interaction
User confirmation ("Did I do it right?")
Metrics update dynamically
🎬 Demo Strategy
Part 1 — Dashboard (Proof)
Show results from 40 test runs
Part 2 — Live Demo (Impact)
Noisy command
System mishears
Context detects mismatch
System asks
User confirms
Dashboard updates live
🧠 Use of Standard Metrics
We optionally use tools like:
WER (jiwer)
DNSMOS (audio quality)
VAD (speech detection)
Tools like VERSA can compute these.
Important
These are baseline metrics.
Our contribution is the application-level metric:
decision correctness
safety
context awareness
🔥 Final Pitch
“We designed an audio intelligence metric that measures whether Sentinel makes correct or safe decisions from noisy speech. By combining context-aware validation and live user feedback, we go beyond transcription accuracy to evaluate real-world system reliability.”
🧠 One-Line Summary
We measure not just what the system hears, but whether it does the right thing.

---

If you want next step, I can:
- turn this into a **slide deck**
- or generate a **UI mockup for the dashboard**

You're now **fully aligned with the track**.

---

## Sentinel Pipeline

```text
Guard voice
   ↓
ai-coustics enhancement
   ↓
STT model
   ↓
Command parser
   ↓
Context-aware validation
   ↓
Decision
   ↓
Action + logging
   ↓
Dashboard update
```

---

## 1. Audio Input

You record guard commands:

```text
open camera three
open aisle five
watch live
replay last ten seconds
send floor associate
mark false alarm
create report
```

Record in:

```text
12 clean samples
25 noisy samples
```

Use same/similar commands in clean and noisy.

---

## 2. Audio Enhancement

Use:

```text
ai-coustics SDK / LiveKit ai-coustics plugin
```

Purpose:

> clean noisy speech before transcription

You should save both:

```text
raw_audio.wav
enhanced_audio.wav
```

---

## 3. Speech-to-Text

Use:

```text
faster-whisper
```

or OpenAI Whisper if easier.

Output:

```json
{
  "raw_transcript": "open aisle four",
  "enhanced_transcript": "open aisle five"
}
```

---

## 4. WER Calculation

Use:

```text
jiwer
```

WER means:

> how different the transcript is from what the user actually said

Example:

```text
Reference: open aisle five
Transcript: open aisle four
WER: 33%
```

This is a support metric, not your main innovation.

---

## 5. Context-Aware Validation

This is your special logic.

Example:

```json
{
  "active_incident": "aisle_5",
  "expected_camera": "camera_5",
  "heard_command": "open aisle 4"
}
```

Your system checks:

```text
Does the command match the current incident context?
Is confidence low?
Is this a risky action?
```

If suspicious:

```text
Sentinel asks: “Did you mean aisle five?”
```

---

## 6. Decision Layer

Possible outcomes:

```text
Correct action
Safe clarification
Dangerous error
```

Examples:

| Situation                              | Result          |
| -------------------------------------- | --------------- |
| Opens correct camera                   | correct action  |
| Asks clarification before risky action | safe recovery   |
| Opens wrong camera                     | dangerous error |

---

## 7. Your Main Metric

## Sentinel Audio Intelligence Score

```text
SAIS = (Correct Actions + Safe Recoveries) / Total Commands
```

This is your unique metric.

It answers:

> Did Sentinel do the correct or safe thing under noisy audio?

---

## 8. Metrics to Show

Use these 5:

```text
1. SAIS
2. Correct Action Rate
3. Safe Recovery Rate
4. Dangerous Error Rate
5. WER
```

Formulas:

```text
Correct Action Rate = correct actions / total commands

Safe Recovery Rate = safe recoveries / total commands

Dangerous Error Rate = dangerous errors / total commands

WER = word errors / total words
```

Optional bonus:

```text
VAD miss rate using silero-vad
DNSMOS using VERSA or DNSMOS
```

But don’t overcomplicate.

---

## 9. Dashboard Outline

### Top Cards

```text
SAIS: 92%
Correct Action Rate: 70%
Safe Recovery Rate: 22%
Dangerous Error Rate: 8%
WER: 12%
```

---

### Comparison Table

| Version                 | SAIS | WER | Dangerous Error Rate |
| ----------------------- | ---: | --: | -------------------: |
| Raw audio               |  55% | 35% |                  30% |
| + ai-coustics           |  80% | 15% |                  12% |
| + ai-coustics + context |  92% | 15% |                   5% |

This is the most important dashboard section.

---

### Interaction Log

| Expected                | Heard                   | Action           | Result        | Reason           |
| ----------------------- | ----------------------- | ---------------- | ------------- | ---------------- |
| open aisle five         | open aisle four         | ask confirmation | safe recovery | context mismatch |
| replay last ten seconds | replay last ten seconds | replay video     | correct       | matched          |
| mark false alarm        | mark alarm              | ask confirmation | safe recovery | risky action     |

---

### Failure Breakdown

Show categories:

```text
number confusion: 60%
low confidence audio: 25%
overlapping speech: 15%
```

---

## 10. JSON Log Format

Save every interaction like this:

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

For recovery:

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

---

## 11. Tools/Models to Use

Minimum winning stack:

```text
ai-coustics       → audio enhancement
faster-whisper    → transcription
jiwer             → WER calculation
custom Python/JS  → SAIS + dashboard metrics
React/Next.js     → dashboard
```

Optional:

```text
silero-vad        → speech detection / missed speech
VERSA or DNSMOS   → audio quality score
```

Skip:

```text
PESQ
STOI
speaker ID
emotion detection
CLAP
heavy research metrics
```

---

## 12. How to Achieve the Dashboard

Simple implementation:

1. Record audio files.
2. Run each through raw STT.
3. Run each through ai-coustics, then STT.
4. Compare transcript to expected command using `jiwer`.
5. Compare actual action to expected action.
6. Run context validation.
7. Save JSON logs.
8. Dashboard reads JSON logs and calculates metrics.

---

## Final Pitch

> “We built Sentinel with a live quality dashboard. Standard metrics like WER show whether the system heard correctly, but our custom Sentinel Audio Intelligence Score measures whether the system made the correct or safe security decision under noisy conditions. The dashboard compares raw audio, ai-coustics-enhanced audio, and context-aware validation, showing how each layer reduces dangerous errors.”
