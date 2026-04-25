# Quality Dashboard Starter

A "quality dashboard" is the smallest set of measurements that tells you whether your voice pipeline is actually working under hostile conditions. This doc shows you how to wire one up in under an hour.

> No code in this folder - by design. This is a recipe, not a framework. Pick the tools that fit your stack.

## What to measure

Four signals catch most failure modes:

| Signal | What it tells you | Tool |
|---|---|---|
| **Non-intrusive MOS** | "Does this sound usable?" | [DNSMOS](https://github.com/microsoft/DNS-Challenge/tree/master/DNSMOS) (SIG / BAK / OVRL) |
| **WER under noise** | "Does the STT still understand?" | [faster-whisper](https://github.com/SYSTRAN/faster-whisper) + [jiwer](https://github.com/jitsi/jiwer) |
| **VAD miss-rate** | "Did we even detect the speech?" | [silero-vad](https://github.com/snakers4/silero-vad) |
| **Loudness (LUFS)** | "Is the input level reasonable?" | [pyloudnorm](https://github.com/csteinmetz1/pyloudnorm) |

That's the floor. Add one app-specific signal on top - semantic match score, task completion rate, latency under load, whatever matters for your demo.

## The fast path: VERSA

If you want one CLI that wraps DNSMOS, UTMOS, PLCMOS, PESQ, STOI, VISQOL, WER, and speaker similarity - install [VERSA](https://github.com/wavlab-speech/versa) and skip writing glue code:

```
pip install versa
versa score --score-config configs/dnsmos.yaml --gen-wav <your_audio_dir>
```

Most teams only need this. Build something custom only if VERSA is missing a signal you specifically need.

## The DIY path

If you need to roll your own (custom integration, latency targets, embedded into a live pipeline), the dependency list is:

```
pip install onnxruntime           # for DNSMOS
pip install faster-whisper jiwer  # for WER
pip install silero-vad            # via torch.hub also works
pip install pyloudnorm            # LUFS
```

### Sketch of the loop

```
clean_ref  ──┐
             ├─► WER (jiwer)        ──┐
noisy_in   ──┘                        │
                                      │
noisy_in  ──► DNSMOS (SIG/BAK/OVRL) ──┤
                                      ├──► dashboard row
noisy_in  ──► silero-vad ──► speech?──┤
                                      │
noisy_in  ──► pyloudnorm ──► LUFS  ──┘
```

For each test clip, run all four measurements. Log results to a CSV or DataFrame. Group by SNR, noise type, RIR, etc. Plot.

### Reference implementations to crib from

- [VERSA's source](https://github.com/wavlab-speech/versa/tree/main/versa/utterance_metrics) - clean reference implementations of every metric.
- [DNSMOS sample script](https://github.com/microsoft/DNS-Challenge/blob/master/DNSMOS/dnsmos_local.py) - minimal end-to-end DNSMOS scoring.
- [TorchAudio-SQUIM tutorial](https://pytorch.org/audio/main/tutorials/squim_tutorial.html) - reference-free PESQ / STOI / SI-SDR estimation.
- [silero-vad README](https://github.com/snakers4/silero-vad#examples-and-dependencies) - torch.hub one-liner.

## Stress-testing - "chaos injector"

Once your dashboard reads, break things on purpose. Apply degradations, re-measure, see what survives.

| Degradation | Tool | Realistic? |
|---|---|---|
| Background noise (cafe, street, gym) | [audiomentations](https://github.com/iver56/audiomentations) `AddBackgroundNoise` + a clip from [ESC-50](https://github.com/karolpiczak/ESC-50) or [DNS-Challenge](https://github.com/microsoft/DNS-Challenge) | Very |
| Reverb | [pyroomacoustics](https://github.com/LCAV/pyroomacoustics) or `audiomentations` `ApplyImpulseResponse` | Very |
| Bandwidth limiting (phone line) | [pedalboard](https://github.com/spotify/pedalboard) low-pass + resample | Very |
| Codec artefacts | `audiomentations` `Mp3Compression` / `Aac` | Very |
| Multiple overlapping speakers | Sum two LibriSpeech clips at varying SNR | Realistic for meetings |
| Mic distance / clipping | `audiomentations` `Gain` + `Clipping` | Realistic for hardware |

### A reasonable stress matrix

Run your dashboard at this grid of conditions and you'll have a story to tell:

- **SNR**: clean, +20 dB, +10 dB, +5 dB, 0 dB
- **Noise type**: cafe babble, traffic, music, keyboard typing, fan
- **Reverb**: anechoic, small room (RT60 ≈ 0.3s), large room (RT60 ≈ 0.8s)

15 noise/reverb combinations × 5 SNR levels × ~20 utterances per cell = ~1500 measurements. Runs in minutes on CPU. Plot DNSMOS-OVRL and WER on the same axes by SNR - that single chart usually tells the story.

## What "good" looks like

Rough rules of thumb (not law - depends on your STT, language, and acceptable error):

- **DNSMOS-OVRL ≥ 3.0** - generally usable for human listening.
- **WER ≤ 15%** - agents can recover from this with LLM post-processing.
- **WER ≥ 30%** - pipeline is breaking; humans struggle here too.
- **VAD miss-rate ≤ 5%** - you're catching the user; above that, conversations feel broken.
- **LUFS between -27 and -16** - input level is in a sensible range for STT.

If your dashboard shows clean conditions hitting these thresholds and noisy conditions falling off a cliff, you have your demo story.

## Going beyond

- **Semantic WER** - embed reference and hypothesis with a sentence transformer, measure cosine distance. Catches "different words, same meaning."
- **CLAP scene check** - score the input audio against text prompts ("clean speech", "speech with traffic noise", "music") to auto-classify what's hitting your pipeline.
- **Latency** - measure end-to-end first-token-out time at each noise level. Some enhancement models add hundreds of ms.
- **Task completion** - for agents, the only metric that matters: did the user accomplish what they were trying to do?

See the "Beyond the usual metrics" section in [`../TOOLKIT.md`](../TOOLKIT.md) for tools.
