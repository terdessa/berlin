from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Literal, Optional
import json


FailureMode = Literal[
    "acoustic_residual_noise",
    "acoustic_confusion",
    "semantic_ambiguity",
    "out_of_vocabulary",
    "multi_cause",
]

Outcome = Literal["success", "error"]

Speaker = Literal["assistant", "guard"]

Command = Literal[
    "open_camera",
    "watch_live",
    "replay_last_10_seconds",
    "send_floor_associate",
    "mark_false_alarm",
    "create_report",
    "unknown",
]


@dataclass
class NisqaScore:
    mos: float
    noisiness: float
    coloration: float
    discontinuity: float
    loudness: float


@dataclass
class NisqaDelta:
    mos: float


@dataclass
class NisqaMeasurement:
    raw: NisqaScore
    enhanced: NisqaScore
    delta: NisqaDelta


@dataclass
class AudioMeasurement:
    raw_clip_path: str
    enhanced_clip_path: str
    nisqa: NisqaMeasurement


@dataclass
class ConversationTurn:
    speaker: Speaker
    # For assistant turns
    text: Optional[str] = None
    # For guard turns
    raw_transcript: Optional[str] = None
    enhanced_transcript: Optional[str] = None
    asr_confidence: Optional[float] = None


@dataclass
class CommandCandidate:
    command: Command
    confidence: float


@dataclass
class Interpretation:
    interpreted_command: Command
    command_confidence: float
    candidates: list[CommandCandidate]
    target_camera_id: Optional[str] = None


@dataclass
class VisualEvent:
    id: str
    camera_id: str
    zone: str
    summary: str
    confidence: float
    frame_url: Optional[str] = None
    clip_url: Optional[str] = None


@dataclass
class FailureRecord:
    failure_mode: FailureMode
    reason: str
    explanation: str
    suggested_clarification: Optional[str] = None
    acoustic_note: Optional[str] = None
    expected_command: Optional[Command] = None


@dataclass
class InteractionRecord:
    id: str
    timestamp: str
    outcome: Outcome
    visual_event: VisualEvent
    audio: AudioMeasurement
    conversation: list[ConversationTurn]
    interpretation: Interpretation
    action_taken: str
    failure: Optional[FailureRecord] = None
    human_correction: Optional[str] = None

    def to_dict(self) -> dict:
        return _camel(asdict(self))

    def to_json(self) -> str:
        return json.dumps(self.to_dict(), indent=2, ensure_ascii=False)


def _camel(obj):
    """Recursively convert snake_case keys to camelCase for JSON output."""
    if isinstance(obj, dict):
        return {_to_camel(k): _camel(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_camel(i) for i in obj]
    return obj


def _to_camel(s: str) -> str:
    parts = s.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])
