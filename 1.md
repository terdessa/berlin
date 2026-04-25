# Example Projects

Six concrete project ideas to inspire your own build. Each one names the failure mode it stresses, the tools that fit best, and what would make a strong demo.

These are not templates - they're sketches. Pick one, remix two, or use them as ammunition for something else entirely.

| # | Project | Failure mode it stresses |
|---|---|---|
| 1 | [Meeting Discipline Keeper](#1-meeting-discipline-keeper) | Overlapping speech, room echo, varying mic distances |
| 2 | [Calisthenics Trainer](#2-calisthenics-trainer-with-vision) | Loud music, dropped weights, gym noise |
| 3 | [Voice-Controlled Language Learning Game](#3-voice-controlled-language-learning-game) | Non-native pronunciation, hesitant speech |
| 4 | [The "Rema 1000" Smart Home](#4-the-rema-1000-smart-home) | Slurred / mumbled / whispered / accented speech |
| 5 | [Private Local Voice Agent (Edge)](#5-private-local-voice-agent-edge-ai) | Resource constraints, no cloud, on-device |
| 6 | [Voice Pipeline Failure Autopsy](#6-voice-pipeline-failure-autopsy) | Systematic measurement of where things break |

---

## 1. Meeting Discipline Keeper

A bot that joins a meeting, tracks the agenda in real time, interrupts off-topic speakers, asks clarifying questions, and updates notes live. Over time, builds a memory of each participant - who runs late, who derails, who never speaks.

**What's hard:** Conference rooms are acoustically hostile. Overlapping speech, room echo, varying mic distances, background noise. STT breaks down exactly when the meeting is most chaotic - and that's when the bot needs to understand best.

**Tools that fit:**
- Agent framework: [Pipecat](https://github.com/pipecat-ai/pipecat) or [LiveKit Agents](https://github.com/livekit/agents)
- Diarization / overlap detection: [pyannote-audio](https://github.com/pyannote/pyannote-audio)
- STT: [faster-whisper](https://github.com/SYSTRAN/faster-whisper) or [whisperX](https://github.com/m-bain/whisperX) for word-level timestamps
- Speech enhancement before STT: [DeepFilterNet](https://github.com/Rikorose/DeepFilterNet) or similar
- Notes integration: any structured doc API (Notion, Google Docs, Linear, etc.)

**Strong demo angle:** Re-enact a chaotic meeting live. The bot interrupts an off-topic speaker mid-sentence, asks for clarification, then updates a shared doc in real time.

---

## 2. Calisthenics Trainer with Vision

A real-time multimodal voice coach (Gemini Live, OpenAI Realtime, etc.) that watches you exercise via camera, counts reps, corrects form, and motivates you mid-set.

**What's hard:** The gym is one of the most hostile environments for voice AI - loud music, dropped weights, multiple people talking nearby. Without front-end audio cleanup, the model hears music more than the user.

**Tools that fit:**
- Realtime S2S model: [Gemini Live](https://ai.google.dev/gemini-api/docs/live) or [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime)
- Speech enhancement: [DeepFilterNet](https://github.com/Rikorose/DeepFilterNet), [Resemble Enhance](https://github.com/resemble-ai/resemble-enhance), or commercial alternatives
- Vision: any pose-estimation model (MediaPipe, MoveNet) for rep counting
- Camera + audio capture: WebRTC via [LiveKit](https://github.com/livekit/agents)

**Strong demo angle:** Do a set of squats live at the demo while the coach counts reps and corrects form. Play loud music in the background to prove the audio pipeline is doing the work.

---

## 3. Voice-Controlled Language Learning Game

A 2D game where the player controls their character only by speaking the language they're learning. Each level is a real-life scenario - ordering at a cafe, buying a train ticket - and NPCs respond naturally, forcing real conversation.

**What's hard:** Language learners are the hardest STT users. Non-native pronunciation, hesitant speech, accent variation. Add a noisy classroom or home and standard STT misses badly enough to break the game loop.

**Tools that fit:**
- STT with strong multilingual support: [Whisper](https://github.com/openai/whisper) (large-v3 or turbo), [faster-whisper](https://github.com/SYSTRAN/faster-whisper)
- Pronunciation scoring: WER vs. expected phrase, or use [SpeechBrain](https://github.com/speechbrain/speechbrain) phoneme recognizers for finer-grained feedback
- LLM for NPC dialogue: any frontier model with a system prompt locking it to the target language
- Game framework: anything you're already comfortable in - Phaser, Godot, plain HTML canvas

**Strong demo angle:** Live audience plays a level. Show the WER score on screen - before and after enhancement - so they see the recognition improve in real time.

---

## 4. The "Rema 1000" Smart Home

Inspired by the [Norwegian supermarket ad](https://www.youtube.com/watch?v=nwPtcqcqz00) where a man's voice-controlled smart home becomes unusable after a dentist visit because his speech is slurred. Build a voice-controlled environment and prove voice control still works when the speaker is impaired - mumbling, illness, whispering, post-anaesthesia, non-native accents.

**What's hard:** Most voice AI tests failure from *the environment* (background noise). This one tests failure from *the speaker themselves*. Different problem, different fix - input speech needs to be clarified, not just denoised.

**Tools that fit:**
- Smart home simulator: a simple web UI with toggleable lights / locks / thermostat is plenty for a demo
- STT robust to degraded speech: try [Whisper large-v3](https://github.com/openai/whisper), [SeamlessM4T](https://github.com/facebookresearch/seamless_communication), or test multiple
- Speech restoration: [voicefixer](https://github.com/haoheliu/voicefixer), [Resemble Enhance](https://github.com/resemble-ai/resemble-enhance)
- Test corpus: [TORGO](https://www.cs.toronto.edu/~complingweb/data/TORGO/torgo.html) or [UA-Speech](http://www.isle.illinois.edu/sst/data/UASpeech/) for dysarthric reference; or self-record yourself whispering / mumbling

**Strong demo angle:** Side-by-side. Same commands, two pipelines. One fails comically (turn on bathroom light → "playing Bathroom by Lana Del Rey"), the other succeeds. Bonus: re-enact the ad.

**Accessibility angle:** This isn't just funny - it's the right framing for elderly users, people with speech impediments, and non-native speakers, who are systematically excluded by current voice AI.

---

## 5. Private Local Voice Agent (Edge AI)

A fully offline voice agent running on a Raspberry Pi or similar - no cloud, no API keys, no data leaving the device. Useful for privacy-sensitive deployments (healthcare, security, kids' devices).

**What's hard:** Everything has to run small. Small STT, small LLM, small enhancement model, small TTS. And the audio quality is usually worse - cheap mics, no acoustic treatment.

**Tools that fit:**
- Lightweight STT: [whisper.cpp](https://github.com/ggerganov/whisper.cpp) (`tiny` or `base.en`), [faster-whisper](https://github.com/SYSTRAN/faster-whisper) with int8 quantization
- Lightweight LLM: [llama.cpp](https://github.com/ggerganov/llama.cpp) with a 1B–4B parameter model, [Ollama](https://ollama.com/) for ease
- Lightweight TTS: [piper](https://github.com/rhasspy/piper) - runs comfortably on a Pi
- Lightweight VAD: [silero-vad](https://github.com/snakers4/silero-vad)
- Lightweight enhancement: [RNNoise](https://github.com/xiph/rnnoise), [DeepFilterNet](https://github.com/Rikorose/DeepFilterNet) (Rust runtime)
- Wake word: [openWakeWord](https://github.com/dscripka/openWakeWord)

**Strong demo angle:** Show the device unplugged from the internet. Cheap USB mic. Still works. Bonus: show power draw / latency numbers.

---

## 6. Voice Pipeline Failure Autopsy

Less of an app, more of a diagnostic tool. Systematically rank where a voice pipeline breaks. Measure how much audio quality alone degrades results. Measure how much enhancement recovers. Quantify how STT model and LLM choice compound the problem.

**What's hard:** This isn't a build challenge - it's a measurement challenge. The contribution is a clear, reproducible answer to "where does voice break first?"

**Tools that fit:**
- Quality metrics: [VERSA](https://github.com/wavlab-speech/versa), [DNSMOS](https://github.com/microsoft/DNS-Challenge/tree/master/DNSMOS), [NISQA](https://github.com/gabrielmittag/NISQA)
- Augmentation: [audiomentations](https://github.com/iver56/audiomentations), [pedalboard](https://github.com/spotify/pedalboard)
- WER: [jiwer](https://github.com/jitsi/jiwer)
- Reference test set: [LibriSpeech](https://www.openslr.org/12) test-clean
- Plotting: pandas + matplotlib / Plotly is plenty

See [`../quality-dashboard/`](../quality-dashboard/) for the wiring details.

**Strong demo angle:** A single chart. X-axis SNR, two lines (DNSMOS-OVRL and WER) before and after enhancement. The story tells itself.

---

## Want to add one?

PRs welcome. See [`../CONTRIBUTING.md`](../CONTRIBUTING.md). Real examples from real builds are especially valuable.
