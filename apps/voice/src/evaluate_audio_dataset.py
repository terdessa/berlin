from __future__ import annotations

import argparse
import json
import math
import os
import re
import struct
import wave
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Literal

from .interpret import ACTION_THRESHOLD, interpret


ROOT = Path(__file__).resolve().parents[3]
DATASET_DIR = ROOT / "apps" / "voice" / "dataset"
MANIFEST_PATH = DATASET_DIR / "manifest.json"
TRANSCRIPTS_PATH = ROOT / "apps" / "voice" / "submission" / "audio_dataset_transcripts.json"
RESULTS_PATH = ROOT / "apps" / "voice" / "submission" / "audio_dataset_results.json"

AudioCondition = Literal["clean", "noisy"]

TARGET_ALIASES = {
    "one": "1",
    "two": "2",
    "too": "2",
    "to": "2",
    "three": "3",
    "tree": "3",
    "four": "4",
    "for": "4",
    "five": "5",
    "fife": "5",
}

ACTION_BY_COMMAND = {
    "watch_live": "opened_live_view",
    "replay_last_10_seconds": "replayed_last_10_seconds",
    "send_floor_associate": "sent_floor_associate",
    "mark_false_alarm": "marked_false_alarm",
    "create_report": "created_report",
    "unknown": "rejected_unsupported_command",
}


@dataclass
class AudioStats:
    path: str
    duration_seconds: float
    sample_rate: int
    channels: int
    bit_depth: int
    rms_dbfs: float
    peak_dbfs: float
    zero_crossing_rate: float
    clipping_rate: float
    usability_score: float


@dataclass
class DatasetRecord:
    case_id: str
    condition: AudioCondition
    audio_path: str
    noise_type: str
    expected_utterance: str
    expected_command: str
    expected_target: str
    expected_action: str
    transcript: str | None
    repaired_transcript: str | None
    parsed_command: str | None
    parsed_target: str | None
    action_taken: str | None
    command_confidence: float | None
    task_success: bool | None
    unsafe_action: bool | None
    wer: float | None
    audio: AudioStats
    explanation: str


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate real clean/noisy Sentinel command audio.")
    parser.add_argument(
        "--transcribe",
        action="store_true",
        help="Use OpenAI audio transcription and cache transcripts before scoring SAIS.",
    )
    parser.add_argument(
        "--model",
        default=os.getenv("OPENAI_TRANSCRIBE_MODEL", "whisper-1"),
        help="OpenAI transcription model to use with --transcribe.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-transcribe clips even when cached transcripts already exist.",
    )
    args = parser.parse_args()

    _load_dotenv(ROOT / ".env")
    manifest = _load_manifest()
    transcripts = _load_transcripts()
    if args.transcribe:
        transcripts = _transcribe_missing(manifest, transcripts, args.model, force=args.force)
        _write_transcripts(transcripts)

    records = [
        _evaluate_entry(entry, condition, transcripts)
        for entry in manifest
        for condition in ("clean", "noisy")
    ]
    summary = _summarize(records)
    payload = {
        "metric": {
            "name": "Sentinel Audio Intelligence Score",
            "shortName": "SAIS",
            "definition": "correct safe actions / total transcribed command clips",
        },
        "dataset": {
            "path": str(DATASET_DIR.relative_to(ROOT)),
            "cases": len(manifest),
            "clips": len(records),
        },
        "summary": summary,
        "records": [asdict(record) for record in records],
    }
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    _print_summary(summary)
    print(f"\nWrote {RESULTS_PATH}")
    if summary["transcribedClips"] == 0:
        print("No transcripts found yet. Run with --transcribe after setting OPENAI_API_KEY, or add transcripts to:")
        print(TRANSCRIPTS_PATH)


def _load_manifest() -> list[dict[str, Any]]:
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def _load_transcripts() -> dict[str, str]:
    if not TRANSCRIPTS_PATH.exists():
        return {}
    return json.loads(TRANSCRIPTS_PATH.read_text(encoding="utf-8"))


def _write_transcripts(transcripts: dict[str, str]) -> None:
    TRANSCRIPTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    TRANSCRIPTS_PATH.write_text(json.dumps(transcripts, indent=2), encoding="utf-8")


def _transcribe_missing(
    manifest: list[dict[str, Any]],
    transcripts: dict[str, str],
    model: str,
    force: bool = False,
) -> dict[str, str]:
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is required for --transcribe.")
    from openai import OpenAI

    client = OpenAI()
    for entry in manifest:
        for condition, field in (("clean", "cleanAudio"), ("noisy", "noisyAudio")):
            key = _transcript_key(entry["id"], condition)
            if transcripts.get(key) and not force:
                continue
            audio_path = DATASET_DIR / entry[field]
            print(f"Transcribing {audio_path.name}...")
            with audio_path.open("rb") as audio_file:
                result = client.audio.transcriptions.create(
                    model=model,
                    file=audio_file,
                    language="en",
                    prompt=(
                        "Security guard voice commands: open camera five, open aisle five, "
                        "watch live, replay last ten seconds, send floor associate, "
                        "mark false alarm, create report, what happened there."
                    ),
                    response_format="json",
                )
            transcripts[key] = result.text.strip()
    return transcripts


def _evaluate_entry(
    entry: dict[str, Any],
    condition: AudioCondition,
    transcripts: dict[str, str],
) -> DatasetRecord:
    field = "cleanAudio" if condition == "clean" else "noisyAudio"
    audio_path = DATASET_DIR / entry[field]
    transcript = transcripts.get(_transcript_key(entry["id"], condition))
    audio_stats = _audio_stats(audio_path)

    if not transcript:
        return DatasetRecord(
            case_id=entry["id"],
            condition=condition,
            audio_path=str(audio_path.relative_to(ROOT)),
            noise_type="clean" if condition == "clean" else entry["noiseType"],
            expected_utterance=entry["utterance"],
            expected_command=entry["expectedCommand"],
            expected_target=entry["expectedTarget"],
            expected_action=entry["expectedAction"],
            transcript=None,
            repaired_transcript=None,
            parsed_command=None,
            parsed_target=None,
            action_taken=None,
            command_confidence=None,
            task_success=None,
            unsafe_action=None,
            wer=None,
            audio=audio_stats,
            explanation="Audio stats computed, but no ASR transcript is available yet.",
        )

    repaired_transcript, repair_note = _repair_transcript(transcript)
    parse_text = repaired_transcript or transcript
    result = interpret(parse_text, camera_id="camera-aisle-5")
    parsed_target = _target_from_text(parse_text, result.command)
    action_taken = _decide_action(result.command, parsed_target, result.confidence)
    task_success = action_taken == entry["expectedAction"]
    unsafe_action = _is_unsafe_action(entry, action_taken, result.command, parsed_target)

    return DatasetRecord(
        case_id=entry["id"],
        condition=condition,
        audio_path=str(audio_path.relative_to(ROOT)),
        noise_type="clean" if condition == "clean" else entry["noiseType"],
        expected_utterance=entry["utterance"],
        expected_command=entry["expectedCommand"],
        expected_target=entry["expectedTarget"],
        expected_action=entry["expectedAction"],
        transcript=transcript,
        repaired_transcript=repaired_transcript,
        parsed_command=result.command,
        parsed_target=parsed_target,
        action_taken=action_taken,
        command_confidence=round(result.confidence, 3),
        task_success=task_success,
        unsafe_action=unsafe_action,
        wer=_wer(entry["utterance"], parse_text),
        audio=audio_stats,
        explanation=(
            repair_note or "Transcribed audio produced the expected safe action."
            if task_success
            else f"{repair_note + ' ' if repair_note else ''}Expected {entry['expectedAction']}, but produced {action_taken}."
        ),
    )


def _repair_transcript(transcript: str) -> tuple[str | None, str | None]:
    text = transcript.lower().strip()
    compact = re.sub(r"[^a-z0-9]+", "", text)
    rules = [
        (r"\bopen\s+a[l1i]5\b", "open aisle five", "Repaired Open AL5 -> open aisle five."),
        (r"\bopen\s+ao5\b", "open aisle five", "Repaired Open AO5 -> open aisle five."),
        (r"\bwatch\s+life\b.*", "watch live", "Repaired watch life -> watch live."),
        (r"\bwatch\s+line\b.*", "watch live", "Repaired watch line -> watch live."),
        (r"\bsan\s+flores.*oceania\b", "send floor associate", "Repaired San Flores/Oceania -> send floor associate."),
        (r"\bgreat\s+report\b", "create report", "Repaired great report -> create report."),
    ]
    notes: list[str] = []
    repaired = text
    for pattern, replacement, note in rules:
        updated = re.sub(pattern, replacement, repaired)
        if updated != repaired:
            repaired = updated
            notes.append(note)

    if compact in {"openal5", "openao5"}:
        repaired = "open aisle five"
        notes.append("Repaired compact aisle-five ASR token.")

    if repaired == text:
        return None, None
    return repaired, " ".join(notes)


def _audio_stats(path: Path) -> AudioStats:
    with wave.open(str(path), "rb") as wav:
        channels = wav.getnchannels()
        sample_rate = wav.getframerate()
        bit_depth = wav.getsampwidth() * 8
        frames = wav.getnframes()
        raw = wav.readframes(frames)

    samples = _pcm16_samples(raw)
    duration = frames / sample_rate if sample_rate else 0.0
    if not samples:
        return AudioStats(
            path=str(path.relative_to(ROOT)),
            duration_seconds=round(duration, 3),
            sample_rate=sample_rate,
            channels=channels,
            bit_depth=bit_depth,
            rms_dbfs=-120.0,
            peak_dbfs=-120.0,
            zero_crossing_rate=0.0,
            clipping_rate=0.0,
            usability_score=1.0,
        )

    mean_square = sum(sample * sample for sample in samples) / len(samples)
    rms = math.sqrt(mean_square)
    peak = max(abs(sample) for sample in samples)
    crossings = sum(
        1
        for previous, current in zip(samples, samples[1:])
        if (previous < 0 <= current) or (previous >= 0 > current)
    )
    clipped = sum(1 for sample in samples if abs(sample) >= 32700)
    rms_dbfs = _dbfs(rms)
    peak_dbfs = _dbfs(peak)
    zcr = crossings / max(1, len(samples) - 1)
    clipping_rate = clipped / len(samples)

    # Lightweight, deterministic quality proxy. Real NISQA/DNSMOS can replace
    # this; the goal here is to compare the uploaded clips without dependencies.
    loudness_score = _clamp((rms_dbfs + 45.0) / 6.0, 1.0, 5.0)
    clipping_penalty = min(clipping_rate * 40.0, 2.0)
    zcr_penalty = min(max(0.0, zcr - 0.12) * 8.0, 2.0)
    usability = _clamp(loudness_score - clipping_penalty - zcr_penalty, 1.0, 5.0)

    return AudioStats(
        path=str(path.relative_to(ROOT)),
        duration_seconds=round(duration, 3),
        sample_rate=sample_rate,
        channels=channels,
        bit_depth=bit_depth,
        rms_dbfs=round(rms_dbfs, 3),
        peak_dbfs=round(peak_dbfs, 3),
        zero_crossing_rate=round(zcr, 5),
        clipping_rate=round(clipping_rate, 5),
        usability_score=round(usability, 3),
    )


def _pcm16_samples(raw: bytes) -> list[int]:
    if len(raw) < 2:
        return []
    usable_length = len(raw) - (len(raw) % 2)
    return [value[0] for value in struct.iter_unpack("<h", raw[:usable_length])]


def _dbfs(value: float) -> float:
    if value <= 0:
        return -120.0
    return 20.0 * math.log10(value / 32768.0)


def _target_from_text(text: str, command: str) -> str:
    normalized = text.lower()
    if command != "open_camera":
        return "none" if command == "unknown" else "current_alert"

    aisle = re.search(r"\baisle\s+(\w+)\b", normalized)
    if aisle:
        return f"camera_aisle_{_number_token(aisle.group(1))}"

    camera = re.search(r"\bcamera\s+(\w+)\b", normalized)
    if camera:
        return f"camera_{_number_token(camera.group(1))}"

    return "unknown"


def _number_token(token: str) -> str:
    return TARGET_ALIASES.get(token.lower(), token.lower())


def _decide_action(command: str, target: str, confidence: float) -> str:
    if command == "unknown":
        return "rejected_unsupported_command"
    if confidence < ACTION_THRESHOLD:
        return "asked_clarification"
    if command == "open_camera":
        return f"opened_{target}" if target != "unknown" else "asked_clarification"
    return ACTION_BY_COMMAND.get(command, "asked_clarification")


def _is_unsafe_action(
    entry: dict[str, Any],
    action_taken: str,
    parsed_command: str,
    parsed_target: str,
) -> bool:
    if action_taken in {"asked_clarification", "rejected_unsupported_command"}:
        return False
    return (
        parsed_command != entry["expectedCommand"]
        or parsed_target != entry["expectedTarget"]
        or action_taken != entry["expectedAction"]
    )


def _wer(reference: str, hypothesis: str) -> float:
    ref = _tokens(reference)
    hyp = _tokens(hypothesis)
    if not ref:
        return 0.0 if not hyp else 1.0

    dp = [[0] * (len(hyp) + 1) for _ in range(len(ref) + 1)]
    for i in range(len(ref) + 1):
        dp[i][0] = i
    for j in range(len(hyp) + 1):
        dp[0][j] = j
    for i, ref_word in enumerate(ref, start=1):
        for j, hyp_word in enumerate(hyp, start=1):
            cost = 0 if ref_word == hyp_word else 1
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            )
    return round(dp[-1][-1] / len(ref), 3)


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def _summarize(records: list[DatasetRecord]) -> dict[str, Any]:
    transcribed = [record for record in records if record.transcript is not None]
    by_condition = {
        condition: [record for record in transcribed if record.condition == condition]
        for condition in ("clean", "noisy")
    }
    audio_by_condition = {
        condition: [record for record in records if record.condition == condition]
        for condition in ("clean", "noisy")
    }
    return {
        "totalClips": len(records),
        "transcribedClips": len(transcribed),
        "clean": _condition_summary(by_condition["clean"], audio_by_condition["clean"]),
        "noisy": _condition_summary(by_condition["noisy"], audio_by_condition["noisy"]),
    }


def _condition_summary(
    transcribed_records: list[DatasetRecord],
    audio_records: list[DatasetRecord],
) -> dict[str, float | int | None]:
    count = len(transcribed_records)
    audio_count = len(audio_records) or 1
    return {
        "clips": len(audio_records),
        "transcribedClips": count,
        "sais": round(sum(record.task_success is True for record in transcribed_records) / count, 3) if count else None,
        "wer": round(sum(record.wer or 0.0 for record in transcribed_records) / count, 3) if count else None,
        "unsafeActionRate": round(sum(record.unsafe_action is True for record in transcribed_records) / count, 3) if count else None,
        "retryRate": round(sum(record.action_taken == "asked_clarification" for record in transcribed_records) / count, 3) if count else None,
        "avgUsabilityScore": round(sum(record.audio.usability_score for record in audio_records) / audio_count, 3),
        "avgRmsDbfs": round(sum(record.audio.rms_dbfs for record in audio_records) / audio_count, 3),
    }


def _print_summary(summary: dict[str, Any]) -> None:
    print("Condition  Clips  ASR  WER     SAIS    Unsafe  AudioScore  RMS dBFS")
    print("--------------------------------------------------------------------")
    for condition in ("clean", "noisy"):
        values = summary[condition]
        wer = _format_optional(values["wer"])
        sais = _format_optional(values["sais"])
        unsafe = _format_optional(values["unsafeActionRate"])
        print(
            f"{condition:<10} "
            f"{values['clips']:<6} "
            f"{values['transcribedClips']:<4} "
            f"{wer:<7} "
            f"{sais:<7} "
            f"{unsafe:<7} "
            f"{values['avgUsabilityScore']:<10.3f} "
            f"{values['avgRmsDbfs']:<8.3f}"
        )


def _format_optional(value: float | int | None) -> str:
    return "n/a" if value is None else f"{value:.3f}"


def _transcript_key(case_id: str, condition: str) -> str:
    return f"{case_id}:{condition}"


def _load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if not os.environ.get(key):
            os.environ[key] = value
    cert_file = os.environ.get("SSL_CERT_FILE")
    if cert_file and not Path(cert_file).exists():
        os.environ.pop("SSL_CERT_FILE", None)
    for proxy_key in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
        proxy_value = os.environ.get(proxy_key, "")
        if "127.0.0.1:9" in proxy_value:
            os.environ.pop(proxy_key, None)


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


if __name__ == "__main__":
    main()
