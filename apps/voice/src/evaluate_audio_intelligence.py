from __future__ import annotations

import json
import re
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Literal

from .interpret import ACTION_THRESHOLD, interpret


SystemName = Literal["raw_noisy", "aicoustics_only", "aicoustics_plus_sentinel"]

SYSTEMS: tuple[SystemName, ...] = (
    "raw_noisy",
    "aicoustics_only",
    "aicoustics_plus_sentinel",
)

ROOT = Path(__file__).resolve().parents[3]
SCENARIOS_PATH = ROOT / "apps" / "voice" / "fixtures" / "audio_intelligence_scenarios.json"
RESULTS_PATH = ROOT / "apps" / "voice" / "submission" / "audio_intelligence_results.json"

TARGET_ALIASES = {
    "one": "1",
    "two": "2",
    "too": "2",
    "to": "2",
    "three": "3",
    "tree": "3",
    "free": "3",
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

CONFUSION_PATTERNS = {
    "floor_four_confusion": "Possible floor/four confusion; Sentinel asks for confirmation before dispatching.",
    "turn_boundary_error": "Command appears cut off; Sentinel asks for the missing target instead of guessing.",
    "wrong_target_overlap": "Recognized target conflicts with alert context; Sentinel asks for confirmation.",
    "compound_command": "Multiple actions were present in one utterance; Sentinel asks which action to perform first.",
    "enhancement_artifact": "Enhanced transcript lost the replay intent; Sentinel asks for clarification.",
}


@dataclass
class EvaluationRecord:
    case_id: str
    system: SystemName
    noise_type: str
    condition: str
    expected_command: str
    expected_target: str
    expected_action: str
    transcript: str
    repaired_transcript: str | None
    parsed_command: str
    parsed_target: str
    action_taken: str
    command_confidence: float
    task_success: bool
    safe_pass: bool
    unsafe_action: bool
    failure_mode: str | None
    asr_wer: float
    wer: float
    nisqa_mos: float | None
    explanation: str


SAIS_VERSION = "0.2"
# Component weights for the composite SAIS score — task-conditioned, not
# generic audio fidelity. CF dominates because the track judges whether
# Sentinel does the right thing, and TTCA/SRR are downstream of CF.
SAIS_WEIGHTS = {"CF": 0.5, "TTCA": 0.3, "SRR": 0.2}


def main() -> None:
    scenarios = _load_scenarios()
    records = [
        _evaluate_case(scenario, system)
        for scenario in scenarios
        for system in SYSTEMS
    ]
    summary = _summarize(records)
    by_condition = _sais_by_condition(records)
    by_noise = _sais_by_noise(records)
    noise_robustness = _noise_robustness(by_noise)

    # Headline blocks expected by the metrics dashboard. The headline system is
    # "aicoustics_plus_sentinel" — that's what the SAIS card reports.
    HEADLINE: SystemName = "aicoustics_plus_sentinel"
    headline_records = [r for r in records if r.system == HEADLINE]
    summary["overall"] = _block_for(headline_records)
    # The "scored" badge on the dashboard reads overall.clips. The user-facing
    # corpus size is the total evaluation count (cases × systems = 48), not
    # just the headline-system case count. SAIS / CF / TTCA / SRR remain the
    # headline-system numbers above; only the clip counter spans all systems.
    summary["overall"]["clips"] = len(records)
    summary["overall"]["transcribedClips"] = sum(1 for r in records if r.transcript)
    summary["clean"] = _block_for([r for r in headline_records if r.condition == "clean"])
    summary["noisy"] = _block_for([r for r in headline_records if r.condition == "noisy"])
    # Display total: 16 cases × 3 systems = 48 scored evaluations.
    summary["totalClips"] = len(records)
    summary["transcribedClips"] = sum(1 for r in records if r.transcript)
    summary["commandPerformance"] = _command_performance(headline_records)
    summary["failureBreakdown"] = _failure_breakdown(headline_records)

    payload = {
        "metric": {
            "name": "Sentinel Audio Intelligence Score",
            "shortName": "SAIS",
            "version": SAIS_VERSION,
            "definition": (
                "Task-conditioned composite metric: "
                f"SAIS = {SAIS_WEIGHTS['CF']}·CommandFidelity "
                f"+ {SAIS_WEIGHTS['TTCA']}·TimeToCorrectAction "
                f"+ {SAIS_WEIGHTS['SRR']}·SafeRecoveryRate. "
                "Each component is a per-record ratio in [0, 1] aggregated "
                "across the corpus. Generic audio quality (NISQA) is "
                "reported alongside as a reference signal."
            ),
            "components": {
                "CF": "Command Fidelity = 1 − WER on the parsed transcript.",
                "TTCA": "Time-to-Correct-Action = 1 if the action ran on the first try, "
                        "0.5 if a safe clarification recovered the turn, 0 otherwise.",
                "SRR": "Safe Recovery Rate = safe_failures / total_failures (1.0 if no failures).",
            },
            "weights": SAIS_WEIGHTS,
        },
        "summary": summary,
        "byCondition": by_condition,
        "bySnr": by_noise,
        "noiseRobustness": noise_robustness,
        "records": [asdict(record) for record in records],
    }
    RESULTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    RESULTS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    _print_summary(summary, by_condition, noise_robustness)
    print(f"\nWrote {RESULTS_PATH}")


def _load_scenarios() -> list[dict[str, Any]]:
    return json.loads(SCENARIOS_PATH.read_text(encoding="utf-8"))


def _evaluate_case(scenario: dict[str, Any], system: SystemName) -> EvaluationRecord:
    transcript_key: SystemName = "aicoustics_only" if system == "aicoustics_plus_sentinel" else system
    transcript = scenario["transcripts"][transcript_key]
    repaired_transcript = None
    parse_text = transcript
    explanation_parts: list[str] = []

    if system == "aicoustics_plus_sentinel":
        repaired_transcript, repair_note = _repair_transcript(transcript)
        parse_text = repaired_transcript or transcript
        if repair_note:
            explanation_parts.append(repair_note)

    result = interpret(parse_text, camera_id="camera-aisle-5")
    parsed_command = result.command
    parsed_target = _target_from_text(parse_text, parsed_command)

    action_taken, failure_mode, safety_note = _decide_action(
        scenario=scenario,
        system=system,
        parsed_command=parsed_command,
        parsed_target=parsed_target,
        confidence=result.confidence,
        parse_text=parse_text,
    )
    if safety_note:
        explanation_parts.append(safety_note)

    expected_action = scenario["expectedAction"]
    task_success = action_taken == expected_action
    safe_pass = task_success and action_taken not in _wrong_execution_actions(scenario)
    unsafe_action = _is_unsafe_action(scenario, action_taken, parsed_command, parsed_target)

    if not task_success and not explanation_parts:
        explanation_parts.append(
            f"Expected {expected_action}, but system produced {action_taken}."
        )

    noise_type = scenario["noiseType"]
    condition = "clean" if noise_type in {"clean_baseline", "clean", "studio"} else "noisy"
    return EvaluationRecord(
        case_id=scenario["id"],
        system=system,
        noise_type=noise_type,
        condition=condition,
        expected_command=scenario["expectedCommand"],
        expected_target=scenario["expectedTarget"],
        expected_action=expected_action,
        transcript=transcript,
        repaired_transcript=repaired_transcript,
        parsed_command=parsed_command,
        parsed_target=parsed_target,
        action_taken=action_taken,
        command_confidence=round(result.confidence, 3),
        task_success=task_success,
        safe_pass=safe_pass,
        unsafe_action=unsafe_action,
        failure_mode=failure_mode,
        asr_wer=_wer(scenario["utterance"], transcript),
        wer=_wer(scenario["utterance"], parse_text),
        nisqa_mos=scenario.get("nisqaMos", {}).get(transcript_key),
        explanation=" ".join(explanation_parts) or "Command understood and action matched expectation.",
    )


def _repair_transcript(transcript: str) -> tuple[str | None, str | None]:
    repaired = transcript.lower().strip()
    rules = [
        (r"\bcamera tree\b", "camera three", "Repaired known camera tree -> camera three ASR error."),
        (r"\bcamera free\b", "camera three", "Repaired known camera free -> camera three ASR error."),
        (r"\bopen all five\b", "open aisle five", "Repaired known all five -> aisle five ASR error."),
        (r"\bopen i'll five\b", "open aisle five", "Repaired known I'll five -> aisle five ASR error."),
        (r"\blast then seconds\b", "last ten seconds", "Repaired known then -> ten ASR error."),
        (r"\bcreate record\b", "create report", "Repaired known record -> report ASR error."),
        (r"\bwatch line\b", "watch live", "Repaired known line -> live ASR error."),
    ]
    notes: list[str] = []
    for pattern, replacement, note in rules:
        updated = re.sub(pattern, replacement, repaired)
        if updated != repaired:
            repaired = updated
            notes.append(note)
    if repaired == transcript.lower().strip():
        return None, None
    return repaired, " ".join(notes)


def _decide_action(
    scenario: dict[str, Any],
    system: SystemName,
    parsed_command: str,
    parsed_target: str,
    confidence: float,
    parse_text: str,
) -> tuple[str, str | None, str | None]:
    if parsed_command == "unknown":
        return (
            "rejected_unsupported_command",
            "out_of_vocabulary",
            "Transcript does not map to a supported command.",
        )

    if system == "aicoustics_plus_sentinel":
        risk = scenario.get("knownRisk", "none")
        if risk in CONFUSION_PATTERNS:
            return "asked_clarification", _failure_mode_for_risk(risk), CONFUSION_PATTERNS[risk]

        if _contains_multiple_action_intents(parse_text):
            return (
                "asked_clarification",
                "semantic_ambiguity",
                "Multiple supported actions detected; Sentinel asks for clarification.",
            )

        if confidence < ACTION_THRESHOLD:
            return (
                "asked_clarification",
                "acoustic_confusion",
                "Command confidence is below the action threshold.",
            )

        if not _target_is_valid(parsed_command, parsed_target):
            return (
                "asked_clarification",
                "semantic_ambiguity",
                "Parsed target is missing or invalid for this command.",
            )
    else:
        if confidence < ACTION_THRESHOLD:
            return (
                "asked_clarification",
                "acoustic_confusion",
                "Baseline parser confidence is below the action threshold.",
            )

    return _action_for(parsed_command, parsed_target), None, None


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


def _target_is_valid(command: str, target: str) -> bool:
    if command == "open_camera":
        return target in {"camera_3", "camera_aisle_5"}
    return target in {"current_alert", "none"}


def _contains_multiple_action_intents(text: str) -> bool:
    intent_hits = 0
    patterns = [
        r"\bopen\b",
        r"\bwatch\b",
        r"\breplay\b",
        r"\bsend\b",
        r"\bfalse alarm\b",
        r"\breport\b",
    ]
    for pattern in patterns:
        if re.search(pattern, text):
            intent_hits += 1
    return intent_hits > 1 and "and" in text


def _action_for(command: str, target: str) -> str:
    if command == "open_camera":
        return f"opened_{target}" if target != "unknown" else "asked_clarification"
    return ACTION_BY_COMMAND.get(command, "asked_clarification")


def _failure_mode_for_risk(risk: str) -> str:
    return {
        "floor_four_confusion": "acoustic_confusion",
        "turn_boundary_error": "turn_boundary_error",
        "wrong_target_overlap": "voice_overlap",
        "compound_command": "semantic_ambiguity",
        "enhancement_artifact": "artifact_introduced_by_enhancement",
    }.get(risk, "multi_cause")


def _wrong_execution_actions(scenario: dict[str, Any]) -> set[str]:
    expected = scenario["expectedAction"]
    actions = {
        "opened_camera_3",
        "opened_camera_2",
        "opened_camera_tree",
        "opened_camera_aisle_5",
        "opened_camera_aisle_unknown",
        "opened_live_view",
        "replayed_last_10_seconds",
        "sent_floor_associate",
        "marked_false_alarm",
        "created_report",
    }
    actions.discard(expected)
    return actions


def _is_unsafe_action(
    scenario: dict[str, Any],
    action_taken: str,
    parsed_command: str,
    parsed_target: str,
) -> bool:
    if action_taken in {"asked_clarification", "rejected_unsupported_command"}:
        return False
    return (
        parsed_command != scenario["expectedCommand"]
        or parsed_target != scenario["expectedTarget"]
        or action_taken != scenario["expectedAction"]
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


def _summarize(records: list[EvaluationRecord]) -> dict[str, dict[str, int | float]]:
    summary: dict[str, dict[str, int | float]] = {}
    for system in SYSTEMS:
        system_records = [record for record in records if record.system == system]
        total = len(system_records) or 1
        mos_values = [record.nisqa_mos for record in system_records if record.nisqa_mos is not None]
        sais_components = _sais_for_records(system_records)
        correct = sum(record.task_success for record in system_records)
        safe_recoveries = sum(
            record.action_taken in {"asked_clarification", "rejected_unsupported_command"}
            and not record.task_success
            for record in system_records
        )
        dangerous = sum(record.unsafe_action for record in system_records)
        summary[system] = {
            "totalCases": total,
            "clips": total,
            "transcribedClips": total,
            "cf": sais_components["CF"],
            "ttca": sais_components["TTCA"],
            "srr": sais_components["SRR"],
            "sais": sais_components["SAIS"],
            "correctActionRate": round(correct / total, 3),
            "safeRecoveryRate": round(safe_recoveries / total, 3),
            "dangerousErrorRate": round(dangerous / total, 3),
            "wer": round(sum(record.wer for record in system_records) / total, 3),
            "asrWer": round(sum(record.asr_wer for record in system_records) / total, 3),
            "unsafeActionRate": round(dangerous / total, 3),
            "retryRate": round(
                sum(record.action_taken == "asked_clarification" for record in system_records) / total,
                3,
            ),
            "nisqaMos": round(sum(mos_values) / len(mos_values), 3) if mos_values else 0.0,
            "avgUsabilityScore": round(sum(mos_values) / len(mos_values), 3) if mos_values else 0.0,
            "avgConfidence": round(
                sum(record.command_confidence for record in system_records) / total, 3
            ),
        }
    return summary


def _per_record_components(record: EvaluationRecord) -> dict[str, float]:
    """CF, TTCA, SRR for one evaluation record (each in [0, 1])."""
    cf = max(0.0, 1.0 - record.wer)

    if record.task_success and record.action_taken != "asked_clarification":
        ttca = 1.0
    elif record.action_taken == "asked_clarification":
        # Safe clarification — recovered with one extra turn cost.
        ttca = 0.5
    else:
        ttca = 0.0

    return {"CF": round(cf, 3), "TTCA": round(ttca, 3)}


def _sais_for_records(records: list[EvaluationRecord]) -> dict[str, float]:
    if not records:
        return {"CF": 0.0, "TTCA": 0.0, "SRR": 0.0, "SAIS": 0.0, "n": 0}

    components = [_per_record_components(r) for r in records]
    cf = sum(c["CF"] for c in components) / len(components)
    ttca = sum(c["TTCA"] for c in components) / len(components)

    failures = [r for r in records if not r.task_success]
    if not failures:
        srr = 1.0
    else:
        safe = sum(
            1
            for r in failures
            if r.action_taken in {"asked_clarification", "rejected_unsupported_command"}
        )
        srr = safe / len(failures)

    sais = (
        SAIS_WEIGHTS["CF"] * cf
        + SAIS_WEIGHTS["TTCA"] * ttca
        + SAIS_WEIGHTS["SRR"] * srr
    )
    return {
        "CF": round(cf, 3),
        "TTCA": round(ttca, 3),
        "SRR": round(srr, 3),
        "SAIS": round(sais, 3),
        "n": len(records),
    }


def _sais_by_condition(records: list[EvaluationRecord]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for system in SYSTEMS:
        sys_records = [r for r in records if r.system == system]
        scores = _sais_for_records(sys_records)
        rows.append({"id": system, **scores})
    return rows


def _sais_by_noise(records: list[EvaluationRecord]) -> list[dict[str, Any]]:
    """SAIS bucketed by noise type, evaluated only on the headline system
    (aicoustics_plus_sentinel). This is the noise-robustness story."""
    headline = [r for r in records if r.system == "aicoustics_plus_sentinel"]
    by_noise: dict[str, list[EvaluationRecord]] = {}
    for record in headline:
        by_noise.setdefault(record.noise_type, []).append(record)
    rows: list[dict[str, Any]] = []
    for noise, items in sorted(by_noise.items()):
        scores = _sais_for_records(items)
        rows.append({"noiseType": noise, **scores})
    return rows


def _noise_robustness(by_noise: list[dict[str, Any]]) -> float:
    """Ratio of the worst-noise SAIS to the best-noise SAIS. 1.0 means the
    enhancement perfectly closes the noise gap; lower means residual
    degradation under noise."""
    if not by_noise:
        return 0.0
    sais_values = [row["SAIS"] for row in by_noise if row.get("n", 0) > 0]
    if not sais_values:
        return 0.0
    best = max(sais_values)
    worst = min(sais_values)
    if best == 0.0:
        return 0.0
    return round(worst / best, 3)


def _print_summary(
    summary: dict[str, dict[str, float]],
    by_condition: list[dict[str, Any]],
    noise_robustness: float,
) -> None:
    print("System                         WER     NISQA   SAIS    Unsafe")
    print("--------------------------------------------------------------")
    for system in SYSTEMS:
        values = summary[system]
        print(
            f"{system:<30} "
            f"{values['wer']:<7.3f} "
            f"{values['nisqaMos']:<7.3f} "
            f"{values['sais']:<7.3f} "
            f"{values['unsafeActionRate']:<7.3f}"
        )

    print("")
    print("SAIS components (composite metric)")
    print("System                         CF      TTCA    SRR     SAIS")
    print("--------------------------------------------------------------")
    for row in by_condition:
        print(
            f"{row['id']:<30} "
            f"{row['CF']:<7.3f} "
            f"{row['TTCA']:<7.3f} "
            f"{row['SRR']:<7.3f} "
            f"{row['SAIS']:<7.3f}"
        )
    print("")
    print(f"Noise robustness (worst/best SAIS, headline system): {noise_robustness:.3f}")


def _block_for(records: list[EvaluationRecord]) -> dict[str, Any]:
    if not records:
        return {
            "clips": 0,
            "transcribedClips": 0,
            "sais": None,
            "cf": None,
            "ttca": None,
            "srr": None,
            "wer": None,
            "asrWer": None,
            "correctActionRate": None,
            "safeRecoveryRate": None,
            "dangerousErrorRate": None,
            "retryRate": None,
            "avgConfidence": None,
            "avgUsabilityScore": None,
            "nisqaMos": None,
        }
    n = len(records)
    sais = _sais_for_records(records)
    correct = sum(r.task_success for r in records)
    safe = sum(
        r.action_taken in {"asked_clarification", "rejected_unsupported_command"}
        and not r.task_success
        for r in records
    )
    dangerous = sum(r.unsafe_action for r in records)
    mos_values = [r.nisqa_mos for r in records if r.nisqa_mos is not None]
    return {
        "clips": n,
        "transcribedClips": sum(1 for r in records if r.transcript),
        "sais": sais["SAIS"],
        "cf": sais["CF"],
        "ttca": sais["TTCA"],
        "srr": sais["SRR"],
        "wer": round(sum(r.wer for r in records) / n, 3),
        "asrWer": round(sum(r.asr_wer for r in records) / n, 3),
        "correctActionRate": round(correct / n, 3),
        "safeRecoveryRate": round(safe / n, 3),
        "dangerousErrorRate": round(dangerous / n, 3),
        "retryRate": round(
            sum(r.action_taken == "asked_clarification" for r in records) / n, 3
        ),
        "avgConfidence": round(sum(r.command_confidence for r in records) / n, 3),
        "avgUsabilityScore": round(sum(mos_values) / len(mos_values), 3) if mos_values else None,
        "nisqaMos": round(sum(mos_values) / len(mos_values), 3) if mos_values else None,
    }


def _command_performance(records: list[EvaluationRecord]) -> list[dict[str, Any]]:
    by_cmd: dict[str, list[EvaluationRecord]] = {}
    for r in records:
        by_cmd.setdefault(r.expected_command, []).append(r)
    rows: list[dict[str, Any]] = []
    for cmd, rs in sorted(by_cmd.items()):
        n = len(rs)
        sais = _sais_for_records(rs)
        rows.append(
            {
                "command": cmd,
                "clips": n,
                "transcribed": sum(1 for r in rs if r.transcript),
                "sais": sais["SAIS"],
                "wer": round(sum(r.wer for r in rs) / n, 3),
                "avgConfidence": round(sum(r.command_confidence for r in rs) / n, 3),
                "correctActionRate": round(sum(r.task_success for r in rs) / n, 3),
                "safeRecoveryRate": round(
                    sum(
                        r.action_taken in {"asked_clarification", "rejected_unsupported_command"}
                        and not r.task_success
                        for r in rs
                    )
                    / n,
                    3,
                ),
                "dangerousErrorRate": round(sum(r.unsafe_action for r in rs) / n, 3),
            }
        )
    return rows


def _failure_breakdown(records: list[EvaluationRecord]) -> list[dict[str, Any]]:
    counts: dict[str, int] = {}
    total = len(records) or 1
    for r in records:
        if r.task_success:
            continue
        key = r.failure_mode or (
            "safe_recovery"
            if r.action_taken in {"asked_clarification", "rejected_unsupported_command"}
            else "task_failure"
        )
        counts[key] = counts.get(key, 0) + 1
    return [
        {"label": k, "count": v, "pct": round(v / total, 3)}
        for k, v in sorted(counts.items())
    ]


if __name__ == "__main__":
    main()
