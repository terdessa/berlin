"""
Command classifier: maps a guard's transcript to one of the six supported
commands and returns a confidence score plus ranked candidates.

Strategy:
- Keyword matching gives a fast, offline baseline (used now).
- Swap `_score_llm` in for production to call an LLM for better accuracy.

Action threshold: 0.7. Below this, the agent asks for clarification rather
than acting. After 3 failed clarifications it writes an error record.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

from .schema import Command, CommandCandidate

ACTION_THRESHOLD = 0.7
MAX_CLARIFICATIONS = 3

# Keyword patterns per command — order matters (most specific first)
_PATTERNS: list[tuple[Command, list[str]]] = [
    ("replay_last_10_seconds", [
        r"replay", r"last\s+ten", r"last\s+10", r"rewind", r"go back",
    ]),
    ("pause_video", [
        r"pause\s+(the\s+)?video", r"pause\s+playback", r"hold\s+(the\s+)?video",
    ]),
    ("resume_playback", [
        r"resume\s+playback", r"resume\s+(the\s+)?video", r"continue\s+playback",
    ]),
    ("watch_live", [
        r"watch\s+live", r"live\s+feed", r"live\s+view", r"show\s+live",
    ]),
    ("zoom_in", [
        r"zoom\s+in", r"zoom\s+in\s+on", r"enlarge", r"closer\s+view",
    ]),
    ("flag_suspicious", [
        r"flag\s+this\s+as\s+suspicious", r"flag\s+suspicious", r"mark\s+suspicious",
    ]),
    ("show_previous_alert", [
        r"show\s+previous\s+alert", r"previous\s+alert", r"last\s+alert",
    ]),
    ("switch_camera", [
        r"switch\s+to\s+camera", r"change\s+to\s+camera", r"switch\s+camera",
    ]),
    ("call_for_backup", [
        r"call\s+for\s+backup", r"call\s+backup", r"request\s+backup",
    ]),
    ("follow_person", [
        r"follow\s+that\s+person", r"track\s+that\s+person", r"follow\s+person",
    ]),
    ("what_happened_there", [
        r"what\s+happened\s+there", r"what\s+happened", r"explain\s+(that|this)",
        r"what\s+do\s+you\s+see", r"what'?s\s+on\s+camera", r"camera\s+three",
        r"camera\s+3", r"what'?s\s+the\s+situation", r"current\s+situation",
    ]),
    ("open_camera", [
        r"open\s+aisle", r"open\s+camera", r"show\s+aisle", r"show\s+camera",
        r"aisle\s+\w+", r"camera\s+\w+",
    ]),
    ("send_floor_associate", [
        r"send\s+floor", r"send\s+associate", r"floor\s+associate",
        r"dispatch", r"send\s+someone",
    ]),
    ("mark_false_alarm", [
        r"false\s+alarm", r"nothing\s+there", r"all\s+clear",
        r"cancel", r"no\s+issue",
    ]),
    ("create_report", [
        r"create\s+report", r"make\s+report", r"log\s+report",
        r"write\s+report", r"file\s+report", r"report",
    ]),
]


@dataclass
class InterpretResult:
    command: Command
    confidence: float
    candidates: list[CommandCandidate]
    target_camera_id: Optional[str] = None
    failure_mode: Optional[str] = None


def interpret(transcript: str, camera_id: Optional[str] = None) -> InterpretResult:
    """
    Classify transcript into a command with confidence.

    Returns an InterpretResult. If confidence < ACTION_THRESHOLD, the caller
    should ask for clarification instead of acting.
    """
    t = transcript.lower().strip()
    scores: dict[Command, float] = {}

    for command, patterns in _PATTERNS:
        hits = [i for i, p in enumerate(patterns) if re.search(p, t)]
        if not hits:
            continue
        # Primary pattern (index 0) is the strongest signal: 0.80 base.
        # Each additional pattern adds 0.05, capped at 0.95.
        primary_hit = 0 in hits
        base = 0.80 if primary_hit else 0.60
        extra = 0.05 * (len(hits) - (1 if primary_hit else 0))
        # Short, focused utterances are more reliable.
        boost = 0.08 if len(t.split()) <= 6 else 0.0
        scores[command] = min(base + extra + boost, 0.95)

    if not scores:
        return InterpretResult(
            command="unknown",
            confidence=0.0,
            candidates=[CommandCandidate(command="unknown", confidence=0.0)],
            failure_mode="out_of_vocabulary",
        )

    ranked: list[CommandCandidate] = [
        CommandCandidate(command=cmd, confidence=round(conf, 3))
        for cmd, conf in sorted(scores.items(), key=lambda x: -x[1])
    ]

    best = ranked[0]
    failure_mode = None

    if best.confidence < ACTION_THRESHOLD:
        # Decide failure mode: if second candidate is close, it's ambiguous
        if len(ranked) > 1 and ranked[1].confidence >= best.confidence * 0.75:
            failure_mode = "semantic_ambiguity"
        else:
            failure_mode = "acoustic_confusion"

    target = _extract_camera_id(t) or camera_id

    return InterpretResult(
        command=best.command,
        confidence=best.confidence,
        candidates=ranked,
        target_camera_id=target,
        failure_mode=failure_mode,
    )


def _extract_camera_id(transcript: str) -> Optional[str]:
    """Try to pull 'aisle N' or 'camera N' from the transcript."""
    m = re.search(r"aisle\s+(\w+)", transcript)
    if m:
        return f"camera-aisle-{m.group(1)}"
    m = re.search(r"camera[\s\-](\w+)", transcript)
    if m:
        return f"camera-{m.group(1)}"
    return None


def failure_explanation(
    result: InterpretResult,
    raw_transcript: str,
    enhanced_transcript: str,
    nisqa_delta: float,
) -> str:
    """
    Generate a human-readable explanation for a failure record.
    Called when confidence < ACTION_THRESHOLD.
    """
    candidates_str = ", ".join(
        f"{c.command} ({c.confidence:.0%})" for c in result.candidates[:3]
    )
    if result.failure_mode == "out_of_vocabulary":
        return (
            f"The guard's utterance (raw: '{raw_transcript}', "
            f"enhanced: '{enhanced_transcript}') did not match any supported command. "
            f"NISQA improvement: +{nisqa_delta:.1f} MOS. "
            "No action taken — command is outside the supported set."
        )
    if result.failure_mode == "acoustic_confusion":
        return (
            f"After enhancement (+{nisqa_delta:.1f} MOS), the most likely interpretation "
            f"was '{result.command}' but confidence ({result.confidence:.0%}) is below "
            f"the action threshold (70%). The enhanced transcript '{enhanced_transcript}' "
            f"may contain acoustically similar words. Candidates considered: {candidates_str}."
        )
    return (
        f"After enhancement (+{nisqa_delta:.1f} MOS), the transcript '{enhanced_transcript}' "
        f"maps to multiple valid commands with similar confidence: {candidates_str}. "
        f"Clarification is needed before acting."
    )
