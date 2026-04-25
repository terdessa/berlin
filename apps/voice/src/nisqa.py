from __future__ import annotations

import json
import os
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

from .schema import NisqaDelta, NisqaMeasurement, NisqaScore


def score_pair(raw_path: str, enhanced_path: str) -> NisqaMeasurement:
    """
    Score a raw/enhanced audio pair.

    If NISQA v2 is installed/configured, this can be swapped to the real CLI.
    For the hackathon demo today we provide a deterministic, audio-derived
    NISQA-like MOS estimate so the corpus is always populated. The interface is
    deliberately identical to the real NISQA fields.
    """
    raw = _score_file(Path(raw_path))
    enhanced = _score_file(Path(enhanced_path))
    return NisqaMeasurement(
        raw=raw,
        enhanced=enhanced,
        delta=NisqaDelta(mos=round(enhanced.mos - raw.mos, 3)),
    )


def _score_file(path: Path) -> NisqaScore:
    if path.exists() and path.stat().st_size > 44:
        samples = _read_pcm(path)
        if samples.size:
            return _estimate_from_samples(samples)

    # Empty/missing audio: keep the record valid, but visibly low quality.
    return NisqaScore(
        mos=1.0,
        noisiness=1.0,
        coloration=1.0,
        discontinuity=1.0,
        loudness=1.0,
    )


def _read_pcm(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as f:
        data = f.readframes(f.getnframes())
    if not data:
        return np.array([], dtype=np.float32)
    return np.frombuffer(data, dtype=np.int16).astype(np.float32) / 32768.0


def _estimate_from_samples(samples: np.ndarray) -> NisqaScore:
    # Simple signal heuristics. This is not the NISQA neural model; it gives us
    # stable, explainable values until the real NISQA repo is installed.
    rms = float(np.sqrt(np.mean(np.square(samples))) + 1e-9)
    peak = float(np.max(np.abs(samples)) + 1e-9)
    crest = peak / rms
    zero_crossings = float(np.mean(np.abs(np.diff(np.signbit(samples))).astype(np.float32)))

    loudness = _clamp(1.0 + min(rms * 18.0, 4.0), 1.0, 5.0)
    noisiness = _clamp(5.0 - zero_crossings * 16.0, 1.0, 5.0)
    discontinuity = _clamp(5.0 - max(0.0, crest - 8.0) * 0.35, 1.0, 5.0)
    coloration = _clamp((noisiness + discontinuity) / 2.0, 1.0, 5.0)
    mos = _clamp((noisiness * 0.35) + (coloration * 0.25) + (discontinuity * 0.25) + (loudness * 0.15), 1.0, 5.0)

    return NisqaScore(
        mos=round(mos, 3),
        noisiness=round(noisiness, 3),
        coloration=round(coloration, 3),
        discontinuity=round(discontinuity, 3),
        loudness=round(loudness, 3),
    )


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))
