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
