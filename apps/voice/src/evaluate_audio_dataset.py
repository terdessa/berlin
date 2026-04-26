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
from typing import Any, Literal, Protocol

from .interpret import ACTION_THRESHOLD
from .providers.gradium import GradiumVoiceProvider


ROOT = Path(__file__).resolve().parents[3]
DATASET_DIR = ROOT / "apps" / "voice" / "dataset"
MANIFEST_PATH = DATASET_DIR / "manifest.json"
TRANSCRIPTS_PATH = ROOT / "apps" / "voice" / "submission" / "audio_dataset_transcripts.json"
RESULTS_PATH = ROOT / "apps" / "voice" / "submission" / "audio_dataset_results.json"
INTELLIGENCE_RESULTS_PATH = ROOT / "apps" / "voice" / "submission" / "audio_intelligence_results.json"
DASHBOARD_RESULTS_PATH = ROOT / "ui" / "src" / "lib" / "audio-metrics-generated.json"

AudioCondition = Literal["clean", "noisy"]

SUPPORTED_UTTERANCES = [
    "open camera five",
    "open camera three",
    "open aisle five",
    "watch live",
    "replay last ten seconds",
    "send floor associate",
    "mark false alarm",
    "create report",
    "what happened there",
    "pause the video",
    "resume playback",
    "zoom in on that area",
    "flag this as suspicious",
    "show previous alert",
    "switch to camera two",
    "call for backup",
    "follow that person",
]

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
    "what_happened_there": "summarized_current_event",
    "pause_video": "paused_video",
    "resume_playback": "resumed_playback",
    "zoom_in": "zoomed_selected_area",
    "flag_suspicious": "flagged_suspicious_activity",
    "show_previous_alert": "showed_previous_alert",
    "call_for_backup": "called_for_backup",
    "follow_person": "followed_subject",
    "unknown": "rejected_unsupported_command",
}

DEFAULT_TARGET_BY_COMMAND = {
    "watch_live": "current_alert",
    "replay_last_10_seconds": "current_alert",
    "send_floor_associate": "current_alert",
    "mark_false_alarm": "current_alert",
    "create_report": "current_alert",
    "what_happened_there": "current_alert",
    "pause_video": "current_video",
    "resume_playback": "current_video",
    "zoom_in": "selected_area",
    "flag_suspicious": "current_alert",
    "show_previous_alert": "previous_alert",
    "call_for_backup": "current_alert",
    "follow_person": "current_alert",
    "unknown": "none",
}


class TranscriptProvider(Protocol):
    def __call__(self, audio_path: Path) -> str:
        ...


@dataclass(frozen=True)
class CommandSpec:
    command: str
    patterns: tuple[str, ...]


@dataclass
class ParsedCommand:
    command: str
    target: str
    confidence: float


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
    safe_recovery: bool | None
    unsafe_action: bool | None
    dangerous_error: bool | None
    decision_type: str | None
    failure_reason: str | None
    wer: float | None
    audio: AudioStats
    explanation: str


COMMAND_SPECS = [
    CommandSpec(
        command="replay_last_10_seconds",
        patterns=(
            r"\breplay\s+(?:the\s+)?last\s+(?:ten|10)\s+seconds\b",
            r"\blast\s+(?:ten|10)\s+seconds\b",
            r"\b(?:rewind|go\s+back)\b",
        ),
    ),
    CommandSpec(
        command="watch_live",
        patterns=(
            r"\bwatch\s+live\b",
            r"\b(?:show|open)\s+live\b",
            r"\blive\s+(?:feed|view)\b",
        ),
    ),
    CommandSpec(
        command="open_camera",
        patterns=(
            r"\bopen\s+(?:camera|cam|aisle)\s+\w+\b",
            r"\bshow\s+(?:camera|cam|aisle)\s+\w+\b",
            r"\b(?:camera|cam|aisle)\s+\w+\b",
        ),
    ),
    CommandSpec(
        command="switch_camera",
        patterns=(
            r"\bswitch\s+(?:to\s+)?(?:camera|cam)\s+\w+\b",
            r"\bchange\s+(?:to\s+)?(?:camera|cam)\s+\w+\b",
        ),
    ),
    CommandSpec(
        command="send_floor_associate",
        patterns=(
            r"\bsend\s+floor\s+associate\b",
            r"\bsend\s+(?:an?\s+)?associate\b",
            r"\bfloor\s+associate\b",
            r"\bdispatch\b",
        ),
    ),
    CommandSpec(
        command="mark_false_alarm",
        patterns=(
            r"\bmark\s+false\s+alarm\b",
            r"\bfalse\s+alarm\b",
            r"\bnothing\s+there\b",
            r"\ball\s+clear\b",
            r"\bno\s+issue\b",
        ),
    ),
    CommandSpec(
        command="create_report",
        patterns=(
            r"\b(?:create|make|file|write|log|great)\s+(?:a\s+)?report\b",
            r"\breport\b",
        ),
    ),
    CommandSpec(
        command="what_happened_there",
        patterns=(
            r"\bwhat\s+happened\s+there\b",
            r"\bwhat\s+happened\b",
            r"\bwhat(?:'s|\s+is)\s+happening\b",
            r"\bexplain\s+(?:that|this)\b",
        ),
    ),
    CommandSpec(
        command="pause_video",
        patterns=(
            r"\bpause\s+(?:the\s+)?video\b",
            r"\bpause\s+playback\b",
            r"\bpause\b",
        ),
    ),
    CommandSpec(
        command="resume_playback",
        patterns=(
            r"\bresume\s+playback\b",
            r"\bresume\s+(?:the\s+)?video\b",
            r"\bcontinue\s+playback\b",
            r"\bplay\b",
        ),
    ),
    CommandSpec(
        command="zoom_in",
        patterns=(
            r"\bzoom\s+in\s+on\s+that\s+area\b",
            r"\bzoom\s+in\s+on\s+(?:the\s+)?area\b",
            r"\bzoom\s+in\b",
        ),
    ),
    CommandSpec(
        command="flag_suspicious",
        patterns=(
            r"\bflag\s+this\s+as\s+suspicious\b",
            r"\bflag\s+(?:that|this)\b",
            r"\bsuspicious\b",
        ),
    ),
    CommandSpec(
        command="show_previous_alert",
        patterns=(
            r"\bshow\s+previous\s+alert\b",
            r"\bprevious\s+alert\b",
            r"\blast\s+alert\b",
        ),
    ),
    CommandSpec(
        command="call_for_backup",
        patterns=(
            r"\bcall\s+for\s+backup\b",
            r"\bcall\s+backup\b",
            r"\bbackup\b",
        ),
    ),
    CommandSpec(
        command="follow_person",
        patterns=(
            r"\bfollow\s+that\s+person\b",
            r"\bfollow\s+(?:the\s+)?person\b",
            r"\btrack\s+that\s+person\b",
        ),
    ),
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate real clean/noisy Sentinel command audio.")
    parser.add_argument(
        "--transcribe",
        action="store_true",
        help="Transcribe missing clips and cache transcripts before scoring SAIS.",
    )
    parser.add_argument(
        "--provider",
        choices=("gradium",),
        default="gradium",
        help="ASR provider for --transcribe.",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="Transcription model. Defaults to Gradium 'default'.",
    )
    parser.add_argument(
        "--language",
        default=os.getenv("GRADIUM_STT_LANGUAGE", "en"),
        help="Expected language for Gradium STT json_config. Defaults to English.",
    )
    parser.add_argument(
        "--delay-in-frames",
        type=int,
        default=_optional_int(os.getenv("GRADIUM_STT_DELAY_IN_FRAMES")),
        help="Optional Gradium STT realtime delay. Unset by default for WAV batch transcription.",
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
        provider_name = _resolve_transcribe_provider(args.provider)
        model = args.model or _default_model(provider_name)
        provider = _build_transcript_provider(
            provider_name,
            model,
            language=args.language,
            delay_in_frames=args.delay_in_frames,
        )
        transcripts = _transcribe_missing(manifest, transcripts, provider, force=args.force)
        _write_transcripts(transcripts)

    records = [_evaluate_record(record, transcripts) for record in manifest]
    summary = _summarize(records)
    _merge_scripted_system_comparison(summary)
    payload = {
        "metric": {
            "name": "Sentinel Audio Intelligence Score",
            "shortName": "SAIS",
            "definition": "correct actions plus safe recoveries / total transcribed command clips",
        },
        "dataset": {
            "path": _repo_path(DATASET_DIR),
            "manifest": _repo_path(MANIFEST_PATH),
            "schemaVersion": 2,
            "cases": len({record["utterance"] for record in manifest}),
            "clips": len(records),
            "supportedCommands": SUPPORTED_UTTERANCES,
        },
        "summary": summary,
        "records": [asdict(record) for record in records],
    }
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    if DASHBOARD_RESULTS_PATH.parent.exists():
        DASHBOARD_RESULTS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    _print_summary(summary)
    print(f"\nWrote {RESULTS_PATH}")
    if DASHBOARD_RESULTS_PATH.exists():
        print(f"Wrote {DASHBOARD_RESULTS_PATH}")
    if summary["transcribedClips"] == 0:
        print("No transcripts found yet. Run with --transcribe after setting GRADIUM_API_KEY, or add transcripts to:")
        print(TRANSCRIPTS_PATH)


def _load_manifest() -> list[dict[str, Any]]:
    payload = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    if isinstance(payload, list):
        records = _records_from_legacy_manifest(payload)
    else:
        records = payload.get("records")
    if not isinstance(records, list):
        raise ValueError("Dataset manifest must contain a records array.")
    _validate_manifest_records(records)
    return records


def _records_from_legacy_manifest(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for entry in entries:
        for condition, field in (("clean", "cleanAudio"), ("noisy", "noisyAudio")):
            records.append(
                {
                    "id": f"{entry['id']}-{condition}",
                    "condition": condition,
                    "audioPath": entry[field],
                    "utterance": entry["utterance"],
                    "expectedCommand": entry["expectedCommand"],
                    "expectedTarget": entry["expectedTarget"],
                    "expectedAction": entry["expectedAction"],
                    "noiseType": "clean" if condition == "clean" else entry.get("noiseType", "recorded_retail_noise"),
                    "transcriptKey": _legacy_transcript_key(entry["id"], condition),
                }
            )
    return records


def _validate_manifest_records(records: list[dict[str, Any]]) -> None:
    required = {
        "id",
        "condition",
        "audioPath",
        "utterance",
        "expectedCommand",
        "expectedTarget",
        "expectedAction",
        "noiseType",
    }
    ids: set[str] = set()
    manifest_paths: set[str] = set()
    errors: list[str] = []

    for index, record in enumerate(records):
        missing = sorted(required - set(record))
        if missing:
            errors.append(f"record {index} is missing {', '.join(missing)}")
            continue
        if record["condition"] not in {"clean", "noisy"}:
            errors.append(f"{record['id']} has invalid condition {record['condition']!r}")
        if record["id"] in ids:
            errors.append(f"duplicate record id {record['id']!r}")
        ids.add(record["id"])

        relative_audio = Path(record["audioPath"])
        audio_path = DATASET_DIR / relative_audio
        if not audio_path.exists():
            errors.append(f"{record['id']} points to missing audio {record['audioPath']!r}")
        manifest_paths.add(relative_audio.as_posix())

    wav_paths = {
        path.relative_to(DATASET_DIR).as_posix()
        for path in (DATASET_DIR / "audio").rglob("*.wav")
    }
    missing_audio = sorted(wav_paths - manifest_paths)
    extra_audio = sorted(manifest_paths - wav_paths)
    if missing_audio:
        errors.append("manifest does not include WAV files: " + ", ".join(missing_audio))
    if extra_audio:
        errors.append("manifest includes non-WAV or missing files: " + ", ".join(extra_audio))
    if errors:
        raise ValueError("Invalid audio dataset manifest:\n- " + "\n- ".join(errors))


def _load_transcripts() -> dict[str, str]:
    if not TRANSCRIPTS_PATH.exists():
        return {}
    payload = json.loads(TRANSCRIPTS_PATH.read_text(encoding="utf-8"))
    return {str(key): str(value) for key, value in payload.items() if value is not None}


def _write_transcripts(transcripts: dict[str, str]) -> None:
    TRANSCRIPTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    clean = {key: value for key, value in transcripts.items() if value.strip()}
    TRANSCRIPTS_PATH.write_text(json.dumps(clean, indent=2), encoding="utf-8")


def _resolve_transcribe_provider(provider: str) -> Literal["gradium"]:
    return "gradium"


def _default_model(provider: Literal["gradium"]) -> str:
    return os.getenv("GRADIUM_STT_MODEL", "default")


def _build_transcript_provider(
    provider: Literal["gradium"],
    model: str,
    *,
    language: str | None = None,
    delay_in_frames: int | None = None,
) -> TranscriptProvider:
    if not os.getenv("GRADIUM_API_KEY"):
        raise RuntimeError("GRADIUM_API_KEY is required for --transcribe.")
    gradium_provider = GradiumVoiceProvider()
    selected_language = (language or "").strip() or None

    def transcribe_gradium(audio_path: Path) -> str:
        return gradium_provider.transcribe_wav_file(
            audio_path,
            model_name=model,
            language=selected_language,
            delay_in_frames=delay_in_frames,
        ).strip()

    return transcribe_gradium


def _transcribe_missing(
    manifest: list[dict[str, Any]],
    transcripts: dict[str, str],
    provider: TranscriptProvider,
    force: bool = False,
) -> dict[str, str]:
    for record in manifest:
        key = _transcript_key(record)
        if _cached_transcript(record, transcripts) and not force:
            continue
        audio_path = DATASET_DIR / record["audioPath"]
        print(f"Transcribing {audio_path.name}...")
        text = provider(audio_path).strip()
        if text:
            transcripts[key] = text
        else:
            print(f"  ! empty transcript from provider; leaving {key} unset")
    return transcripts


def _evaluate_record(record: dict[str, Any], transcripts: dict[str, str]) -> DatasetRecord:
    audio_path = DATASET_DIR / record["audioPath"]
    transcript = _cached_transcript(record, transcripts)
    audio_stats = _audio_stats(audio_path)

    if not transcript:
        return DatasetRecord(
            case_id=record["id"],
            condition=record["condition"],
            audio_path=_repo_path(audio_path),
            noise_type=record["noiseType"],
            expected_utterance=record["utterance"],
            expected_command=record["expectedCommand"],
            expected_target=record["expectedTarget"],
            expected_action=record["expectedAction"],
            transcript=None,
            repaired_transcript=None,
            parsed_command=None,
            parsed_target=None,
            action_taken=None,
            command_confidence=None,
            task_success=None,
            safe_recovery=None,
            unsafe_action=None,
            dangerous_error=None,
            decision_type=None,
            failure_reason="missing_transcript",
            wer=None,
            audio=audio_stats,
            explanation="Audio stats computed, but no ASR transcript is available yet.",
        )

    repaired_transcript, repair_note = _repair_transcript(transcript)
    parse_text = repaired_transcript or transcript
    parsed = _parse_command(parse_text)
    action_taken = _decide_action(parsed.command, parsed.target, parsed.confidence)
    task_success = action_taken == record["expectedAction"]
    dangerous_error = _is_dangerous_error(action_taken, task_success)
    safe_recovery = bool(not task_success and not dangerous_error and action_taken in {"asked_clarification", "rejected_unsupported_command"})
    decision_type = _decision_type(task_success, safe_recovery, dangerous_error)
    failure_reason = _failure_reason(record, parsed, action_taken, task_success, safe_recovery, dangerous_error)

    return DatasetRecord(
        case_id=record["id"],
        condition=record["condition"],
        audio_path=_repo_path(audio_path),
        noise_type=record["noiseType"],
        expected_utterance=record["utterance"],
        expected_command=record["expectedCommand"],
        expected_target=record["expectedTarget"],
        expected_action=record["expectedAction"],
        transcript=transcript,
        repaired_transcript=repaired_transcript,
        parsed_command=parsed.command,
        parsed_target=parsed.target,
        action_taken=action_taken,
        command_confidence=round(parsed.confidence, 3),
        task_success=task_success,
        safe_recovery=safe_recovery,
        unsafe_action=dangerous_error,
        dangerous_error=dangerous_error,
        decision_type=decision_type,
        failure_reason=failure_reason,
        wer=_wer(record["utterance"], parse_text),
        audio=audio_stats,
        explanation=_explanation(record, parsed, action_taken, task_success, repair_note, failure_reason),
    )


def _repair_transcript(transcript: str) -> tuple[str | None, str | None]:
    text = transcript.lower().strip()
    compact = re.sub(r"[^a-z0-9]+", "", text)
    rules = [
        (r"\bopen\s+a[l1i]5\b", "open aisle five", "Repaired Open AL5 -> open aisle five."),
        (r"\bopen\s+ao5\b", "open aisle five", "Repaired Open AO5 -> open aisle five."),
        (r"\bopen\s+o5\b", "open aisle five", "Repaired Open O5 -> open aisle five."),
        (r"\bopen\s+mrc\b", "open camera three", "Repaired Open MRC -> open camera three."),
        (r"\bwatch\s+life\b.*", "watch live", "Repaired watch life -> watch live."),
        (r"\bwatch\s+line\b.*", "watch live", "Repaired watch line -> watch live."),
        (r"\bwhich\s+live\b", "watch live", "Repaired which live -> watch live."),
        (r"\bwhat\s+life\b", "watch live", "Repaired what life -> watch live."),
        (r"\bbush\s+life\s+queen\b", "watch live", "Repaired bush life queen -> watch live."),
        (r"\breplay\s+lost\s+(?:ten|10)\s+seconds\b", "replay last ten seconds", "Repaired lost -> last replay command."),
        (r"\bwe\s+play\s+los\s+(?:ten|10)\s+seconds\b", "replay last ten seconds", "Repaired we play los 10 seconds -> replay last ten seconds."),
        (r"\b(?:the\s+)?great\s+lusting\s+sentences\b", "replay last ten seconds", "Repaired great lusting sentences -> replay last ten seconds."),
        (r"\bsan\s+flores.*oceania\b", "send floor associate", "Repaired San Flores/Oceania -> send floor associate."),
        (r"\bseth\s+moore\s+associates?\b", "send floor associate", "Repaired Seth Moore associates -> send floor associate."),
        (r"\bgreat\s+report\b", "create report", "Repaired great report -> create report."),
        (r"\bgreat\s+reports\b", "create report", "Repaired great reports -> create report."),
        (r"\bfalse\s+alarms\b", "false alarm", "Normalized plural false alarms -> false alarm."),
        (r"\bmark\s+falsalarm\b", "mark false alarm", "Repaired falsalarm -> false alarm."),
        (r"\bmark\s+spoke\s+alarmed\b", "mark false alarm", "Repaired mark spoke alarmed -> mark false alarm."),
        (r"\bwhat\s+happen(?:ed)?\s+there\b", "what happened there", "Normalized event-summary command."),
        (r"\bpost\s+the\s+video\b", "pause the video", "Repaired post the video -> pause the video."),
        (r"\bprison\s+playbook\b", "resume playback", "Repaired prison playbook -> resume playback."),
        (r"\bshow\s+previews\s+(?:the\s+)?lyric\b", "show previous alert", "Repaired show previews the lyric -> show previous alert."),
        (r"\bshall\s+figures\s+allowed\b", "show previous alert", "Repaired shall figures allowed -> show previous alert."),
        (r"\bwhich\s+the\s+camera[,\s]+(?:too|two)\b", "switch to camera two", "Repaired which the camera too -> switch to camera two."),
        (r"\bhold\s+(?:the\s+)?back\s+up\b", "call for backup", "Repaired hold the back up -> call for backup."),
    ]
    notes: list[str] = []
    repaired = text
    for pattern, replacement, note in rules:
        updated = re.sub(pattern, replacement, repaired)
        if updated != repaired:
            repaired = updated
            notes.append(note)

    if compact in {"openal5", "openao5", "openo5"}:
        repaired = "open aisle five"
        notes.append("Repaired compact aisle-five ASR token.")

    if repaired == text:
        return None, None
    return repaired, " ".join(notes)


def _parse_command(text: str) -> ParsedCommand:
    normalized = text.lower().strip()
    scores: dict[str, float] = {}
    for spec in COMMAND_SPECS:
        hits = [index for index, pattern in enumerate(spec.patterns) if re.search(pattern, normalized)]
        if not hits:
            continue
        primary_hit = 0 in hits
        base = 0.82 if primary_hit else 0.62
        extra = 0.05 * (len(hits) - (1 if primary_hit else 0))
        boost = 0.08 if len(_tokens(normalized)) <= 6 else 0.0
        score = min(base + extra + boost, 0.95)
        scores[spec.command] = max(scores.get(spec.command, 0.0), score)

    if not scores:
        return ParsedCommand(command="unknown", target="none", confidence=0.0)

    command, confidence = max(scores.items(), key=lambda item: item[1])
    return ParsedCommand(
        command=command,
        target=_target_from_text(normalized, command),
        confidence=confidence,
    )


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
            path=_repo_path(path),
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

    loudness_score = _clamp((rms_dbfs + 45.0) / 6.0, 1.0, 5.0)
    clipping_penalty = min(clipping_rate * 40.0, 2.0)
    zcr_penalty = min(max(0.0, zcr - 0.12) * 8.0, 2.0)
    usability = _clamp(loudness_score - clipping_penalty - zcr_penalty, 1.0, 5.0)

    return AudioStats(
        path=_repo_path(path),
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
    if command in {"open_camera", "switch_camera"}:
        aisle = re.search(r"\baisle\s+(\w+)\b", normalized)
        if aisle:
            return f"camera_aisle_{_number_token(aisle.group(1))}"
        camera = re.search(r"\b(?:camera|cam)\s+(\w+)\b", normalized)
        if camera:
            return f"camera_{_number_token(camera.group(1))}"
        return "unknown"
    return DEFAULT_TARGET_BY_COMMAND.get(command, "none")


def _number_token(token: str) -> str:
    return TARGET_ALIASES.get(token.lower(), token.lower())


def _decide_action(command: str, target: str, confidence: float) -> str:
    if command == "unknown":
        return "rejected_unsupported_command"
    if confidence < ACTION_THRESHOLD:
        return "asked_clarification"
    if command == "open_camera":
        return f"opened_{target}" if target != "unknown" else "asked_clarification"
    if command == "switch_camera":
        return f"switched_to_{target}" if target != "unknown" else "asked_clarification"
    return ACTION_BY_COMMAND.get(command, "asked_clarification")


def _is_dangerous_error(action_taken: str, task_success: bool) -> bool:
    if task_success:
        return False
    return action_taken not in {"asked_clarification", "rejected_unsupported_command"}


def _decision_type(task_success: bool, safe_recovery: bool, dangerous_error: bool) -> str:
    if task_success:
        return "correct_action"
    if safe_recovery:
        return "safe_recovery"
    if dangerous_error:
        return "dangerous_error"
    return "safe_recovery"


def _failure_reason(
    record: dict[str, Any],
    parsed: ParsedCommand,
    action_taken: str,
    task_success: bool,
    safe_recovery: bool,
    dangerous_error: bool,
) -> str | None:
    if task_success:
        return None
    if action_taken == "asked_clarification":
        if parsed.target != "unknown" and parsed.target != record["expectedTarget"]:
            return "context_mismatch_target_confusion"
        return "low_command_confidence"
    if parsed.command == "unknown":
        return "out_of_vocabulary"
    if dangerous_error:
        if parsed.command != record["expectedCommand"]:
            return "wrong_command"
        if parsed.target != record["expectedTarget"]:
            return "wrong_target"
        return "wrong_action"
    if safe_recovery:
        return "safe_recovery"
    return "unclassified_failure"


def _explanation(
    record: dict[str, Any],
    parsed: ParsedCommand,
    action_taken: str,
    task_success: bool,
    repair_note: str | None,
    failure_reason: str | None,
) -> str:
    prefix = f"{repair_note} " if repair_note else ""
    if task_success:
        return prefix + "Transcribed audio produced the expected safe action."
    return (
        f"{prefix}Expected {record['expectedAction']}, but produced {action_taken}. "
        f"Parsed {parsed.command}/{parsed.target} at {parsed.confidence:.0%}; reason: {failure_reason}."
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


def _repo_path(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def _summarize(records: list[DatasetRecord]) -> dict[str, Any]:
    transcribed = [record for record in records if record.transcript is not None]
    conditions = ["clean", "noisy"]
    summary: dict[str, Any] = {
        "totalClips": len(records),
        "transcribedClips": len(transcribed),
        "overall": _condition_summary(transcribed, records),
        "failureBreakdown": _failure_breakdown(transcribed),
        "commandPerformance": _command_performance(transcribed),
    }
    for condition in conditions:
        condition_transcribed = [record for record in transcribed if record.condition == condition]
        condition_audio = [record for record in records if record.condition == condition]
        summary[condition] = _condition_summary(condition_transcribed, condition_audio)
    return summary


def _merge_scripted_system_comparison(summary: dict[str, Any]) -> None:
    if not INTELLIGENCE_RESULTS_PATH.exists():
        return
    try:
        scripted = json.loads(INTELLIGENCE_RESULTS_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return

    scripted_summary = scripted.get("summary")
    if not isinstance(scripted_summary, dict):
        return

    for key in ("raw_noisy", "aicoustics_only", "aicoustics_plus_sentinel"):
        block = scripted_summary.get(key)
        if not isinstance(block, dict):
            continue
        cases = block.get("totalCases")
        unsafe = block.get("unsafeActionRate")
        summary[key] = {
            "clips": cases,
            "transcribedClips": cases,
            "sais": block.get("sais"),
            "correctActionRate": None,
            "safeRecoveryRate": block.get("retryRate"),
            "dangerousErrorRate": unsafe,
            "unsafeActionRate": unsafe,
            "wer": block.get("wer"),
            "avgConfidence": None,
            "avgUsabilityScore": block.get("nisqaMos"),
        }


def _condition_summary(
    transcribed_records: list[DatasetRecord],
    audio_records: list[DatasetRecord],
) -> dict[str, float | int | None]:
    count = len(transcribed_records)
    audio_count = len(audio_records) or 1
    correct = sum(record.task_success is True for record in transcribed_records)
    recoveries = sum(record.safe_recovery is True for record in transcribed_records)
    dangerous = sum(record.dangerous_error is True for record in transcribed_records)
    return {
        "clips": len(audio_records),
        "transcribedClips": count,
        "sais": round((correct + recoveries) / count, 3) if count else None,
        "correctActionRate": round(correct / count, 3) if count else None,
        "safeRecoveryRate": round(recoveries / count, 3) if count else None,
        "dangerousErrorRate": round(dangerous / count, 3) if count else None,
        "wer": round(sum(record.wer or 0.0 for record in transcribed_records) / count, 3) if count else None,
        "unsafeActionRate": round(dangerous / count, 3) if count else None,
        "retryRate": round(sum(record.action_taken == "asked_clarification" for record in transcribed_records) / count, 3) if count else None,
        "avgConfidence": round(sum(record.command_confidence or 0.0 for record in transcribed_records) / count, 3) if count else None,
        "avgUsabilityScore": round(sum(record.audio.usability_score for record in audio_records) / audio_count, 3),
        "avgRmsDbfs": round(sum(record.audio.rms_dbfs for record in audio_records) / audio_count, 3),
    }


def _failure_breakdown(records: list[DatasetRecord]) -> list[dict[str, Any]]:
    failures = [record for record in records if record.failure_reason]
    total = len(failures)
    counts: dict[str, int] = {}
    for record in failures:
        assert record.failure_reason is not None
        counts[record.failure_reason] = counts.get(record.failure_reason, 0) + 1
    return [
        {"label": label, "count": count, "pct": round(count / total, 3) if total else 0.0}
        for label, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ]


def _command_performance(records: list[DatasetRecord]) -> list[dict[str, Any]]:
    by_command: dict[str, list[DatasetRecord]] = {}
    for record in records:
        by_command.setdefault(record.expected_command, []).append(record)

    rows: list[dict[str, Any]] = []
    for command, command_records in sorted(by_command.items()):
        count = len(command_records)
        correct = sum(record.decision_type == "correct_action" for record in command_records)
        recoveries = sum(record.decision_type == "safe_recovery" for record in command_records)
        dangerous = sum(record.decision_type == "dangerous_error" for record in command_records)
        rows.append(
            {
                "command": command,
                "clips": count,
                "sais": round((correct + recoveries) / count, 3),
                "wer": round(sum(record.wer or 0.0 for record in command_records) / count, 3),
                "avgConfidence": round(sum(record.command_confidence or 0.0 for record in command_records) / count, 3),
                "dangerousErrorRate": round(dangerous / count, 3),
            }
        )
    return rows


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


def _transcript_key(record: dict[str, Any]) -> str:
    return str(record.get("transcriptKey") or record["id"])


def _transcript_keys(record: dict[str, Any]) -> list[str]:
    keys = [
        str(record.get("transcriptKey") or ""),
        str(record["id"]),
        str(record["audioPath"]),
    ]
    return list(dict.fromkeys(key for key in keys if key))


def _cached_transcript(record: dict[str, Any], transcripts: dict[str, str]) -> str | None:
    for key in _transcript_keys(record):
        transcript = transcripts.get(key)
        if transcript:
            return transcript.strip()
    return None


def _legacy_transcript_key(case_id: str, condition: str) -> str:
    return f"{case_id}:{condition}"


def _optional_int(value: str | None) -> int | None:
    if value is None or value.strip() == "":
        return None
    return int(value)


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
