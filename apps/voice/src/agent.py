"""
Sentinel voice agent.

Pipeline:
  guard mic → ai-coustics (noise enhancement) → STT → command interpreter → action
  Every interaction is logged to submission/interactions.json.

Run:
  python -m src.agent --room <room-name>
  or let the LiveKit worker framework dispatch jobs automatically.

Credentials (set in .env at repo root):
  LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET
  AICOUSTICS_API_KEY
  OPENAI_API_KEY  (STT/TTS until telli is wired)
"""

from __future__ import annotations

import asyncio
import datetime
import os
import uuid
import wave
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent.parent / ".env")

from livekit.agents import (
    AgentSession,
    AutoSubscribe,
    JobContext,
    RoomIO,
    WorkerOptions,
    cli,
    llm,
)
from livekit.agents.voice import Agent
from livekit.agents.voice.room_io import RoomInputOptions
from livekit.plugins import openai as lk_openai
from livekit.plugins import ai_coustics
from livekit.plugins.ai_coustics import EnhancerModel

from .interpret import (
    ACTION_THRESHOLD,
    MAX_CLARIFICATIONS,
    InterpretResult,
    failure_explanation,
    interpret,
)
from .schema import (
    AudioMeasurement,
    CommandCandidate,
    ConversationTurn,
    FailureRecord,
    Interpretation,
    InteractionRecord,
    NisqaDelta,
    NisqaMeasurement,
    NisqaScore,
    VisualEvent,
)
from . import logger as corpus_logger

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

_REPO_ROOT = Path(__file__).parent.parent.parent.parent
_SUBMISSION = Path(__file__).parent.parent / "submission"
_AUDIO_RAW = _SUBMISSION / "audio" / "raw"
_AUDIO_ENHANCED = _SUBMISSION / "audio" / "enhanced"

for _p in (_AUDIO_RAW, _AUDIO_ENHANCED):
    _p.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Mock visual event (replaced by Person 2's Gemini output in integration)
# ---------------------------------------------------------------------------

MOCK_VISUAL_EVENT = VisualEvent(
    id="event-aisle-5",
    camera_id="camera-aisle-5",
    zone="Aisle 5",
    summary=(
        "Item appears to move from shelf to pocket. "
        "Human review recommended."
    ),
    confidence=0.82,
    frame_url="frames/aisle-5-alert.jpg",
    clip_url="clips/aisle-5-event.mp4",
)

EARPIECE_ALERT = (
    "Aisle 5 requires review. "
    "Item appears to move from shelf to pocket. "
    "Human review recommended."
)

# ---------------------------------------------------------------------------
# Sentinel agent instructions
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = f"""
You are Sentinel, a voice security copilot for a retail store guard.
You speak through the guard's earpiece.

Rules:
- Be brief and clear. The guard is in a noisy store.
- Never say "thief", "criminal", "stealing", or make identity claims.
- Use language like "requires review", "item appears to move", "human review recommended".
- When you don't understand the guard, ask for clarification. Never guess and act.
- Supported commands you can execute: open camera, watch live, replay last 10 seconds,
  send floor associate, mark false alarm, create report.
- If the guard's command is unclear, say exactly:
  "I didn't catch that clearly. Did you mean [your best guess]?"

Current alert: {EARPIECE_ALERT}
""".strip()

# ---------------------------------------------------------------------------
# Placeholder NISQA scores
# Real NISQA scoring runs offline via scripts/score_nisqa.py after the session.
# ---------------------------------------------------------------------------

def _placeholder_nisqa(raw_path: str, enhanced_path: str) -> NisqaMeasurement:
    """
    Returns placeholder NISQA scores.
    Replace with real NISQA v2 scoring once the offline script is integrated.
    """
    return NisqaMeasurement(
        raw=NisqaScore(mos=2.1, noisiness=1.8, coloration=2.4, discontinuity=2.6, loudness=3.0),
        enhanced=NisqaScore(mos=3.7, noisiness=3.8, coloration=3.6, discontinuity=3.9, loudness=3.8),
        delta=NisqaDelta(mos=1.6),
    )


# ---------------------------------------------------------------------------
# Session state per call
# ---------------------------------------------------------------------------

class SentinelSession:
    def __init__(self, visual_event: VisualEvent):
        self.visual_event = visual_event
        self.conversation: list[ConversationTurn] = []
        self.clarification_count = 0
        self.interaction_id = f"interaction-{datetime.datetime.utcnow().isoformat()}Z-{visual_event.camera_id}"
        self.timestamp = datetime.datetime.utcnow().isoformat() + "Z"
        self.raw_audio_chunks: list[bytes] = []
        self.enhanced_audio_chunks: list[bytes] = []

    def add_assistant_turn(self, text: str):
        self.conversation.append(ConversationTurn(speaker="assistant", text=text))

    def add_guard_turn(self, raw: str, enhanced: str, asr_confidence: float):
        self.conversation.append(ConversationTurn(
            speaker="guard",
            raw_transcript=raw,
            enhanced_transcript=enhanced,
            asr_confidence=asr_confidence,
        ))

    def save_audio(self, sample_rate: int = 16000) -> tuple[str, str]:
        ts = self.timestamp.replace(":", "-").replace(".", "-")
        raw_path = str(_AUDIO_RAW / f"{ts}.wav")
        enhanced_path = str(_AUDIO_ENHANCED / f"{ts}.wav")
        # Audio saving is a stub — real implementation captures frames from LiveKit
        return raw_path, enhanced_path

    def write_success(self, result: InterpretResult, action_taken: str):
        raw_path, enhanced_path = self.save_audio()
        nisqa = _placeholder_nisqa(raw_path, enhanced_path)
        record = InteractionRecord(
            id=self.interaction_id,
            timestamp=self.timestamp,
            outcome="success",
            visual_event=self.visual_event,
            audio=AudioMeasurement(
                raw_clip_path=raw_path,
                enhanced_clip_path=enhanced_path,
                nisqa=nisqa,
            ),
            conversation=self.conversation,
            interpretation=Interpretation(
                interpreted_command=result.command,
                command_confidence=round(result.confidence, 3),
                candidates=result.candidates,
                target_camera_id=result.target_camera_id,
            ),
            action_taken=action_taken,
            failure=None,
        )
        corpus_logger.append(record)
        return record

    def write_failure(
        self,
        result: InterpretResult,
        raw_transcript: str,
        enhanced_transcript: str,
        reason: str,
    ):
        raw_path, enhanced_path = self.save_audio()
        nisqa = _placeholder_nisqa(raw_path, enhanced_path)
        explanation = failure_explanation(
            result,
            raw_transcript,
            enhanced_transcript,
            nisqa_delta=nisqa.delta.mos,
        )
        acoustic_note = (
            f"NISQA: raw {nisqa.raw.mos:.1f} → enhanced {nisqa.enhanced.mos:.1f} "
            f"(+{nisqa.delta.mos:.1f} MOS)."
        ) if nisqa else None

        record = InteractionRecord(
            id=self.interaction_id,
            timestamp=self.timestamp,
            outcome="error",
            visual_event=self.visual_event,
            audio=AudioMeasurement(
                raw_clip_path=raw_path,
                enhanced_clip_path=enhanced_path,
                nisqa=nisqa,
            ),
            conversation=self.conversation,
            interpretation=Interpretation(
                interpreted_command=result.command,
                command_confidence=round(result.confidence, 3),
                candidates=result.candidates,
                target_camera_id=result.target_camera_id,
            ),
            action_taken="none",
            failure=FailureRecord(
                failure_mode=result.failure_mode or "acoustic_confusion",
                reason=reason,
                explanation=explanation,
                acoustic_note=acoustic_note,
                suggested_clarification=(
                    f"Did you mean {result.command.replace('_', ' ')} "
                    f"at {self.visual_event.zone}?"
                ),
                expected_command=result.command if result.command != "unknown" else None,
            ),
        )
        corpus_logger.append(record)
        return record


# ---------------------------------------------------------------------------
# LiveKit agent entrypoint
# ---------------------------------------------------------------------------

async def entrypoint(ctx: JobContext):
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    session = SentinelSession(visual_event=MOCK_VISUAL_EVENT)

    agent = Agent(instructions=SYSTEM_PROMPT)

    agent_session = AgentSession(
        stt=lk_openai.STT(),     # swap for telli STT when available
        tts=lk_openai.TTS(),     # swap for telli TTS when available
        llm=lk_openai.LLM(),
    )

    session.add_assistant_turn(EARPIECE_ALERT)

    @agent_session.on("user_speech_committed")
    def on_guard_speech(event):
        raw_text = getattr(event, "raw_transcript", event.transcript)
        enhanced_text = event.transcript
        asr_confidence = getattr(event, "confidence", 1.0)

        session.add_guard_turn(raw_text, enhanced_text, asr_confidence)

        result = interpret(enhanced_text, camera_id=MOCK_VISUAL_EVENT.camera_id)

        if result.confidence >= ACTION_THRESHOLD:
            action = _route_command(result)
            session.add_assistant_turn(action["response"])
            session.write_success(result, action["action_taken"])
        else:
            session.clarification_count += 1
            if session.clarification_count >= MAX_CLARIFICATIONS:
                session.write_failure(
                    result,
                    raw_text,
                    enhanced_text,
                    reason="max_clarifications_reached",
                )
                return

            clarification = (
                f"I didn't catch that clearly. "
                f"Did you mean {result.command.replace('_', ' ')} "
                f"at {MOCK_VISUAL_EVENT.zone}?"
            )
            session.add_assistant_turn(clarification)

    # Wire ai-coustics noise cancellation on the incoming guard audio via RoomIO
    room_io = RoomIO(
        agent_session,
        room=ctx.room,
        input_options=RoomInputOptions(
            noise_cancellation=ai_coustics.audio_enhancement(
                model=EnhancerModel.QUAIL_L,
            ),
        ),
    )

    await agent_session.start(agent, room_io=room_io)
    await agent_session.say(EARPIECE_ALERT, allow_interruptions=True)


def _route_command(result: InterpretResult) -> dict:
    """Map a classified command to a response string and action label."""
    responses = {
        "open_camera": (
            f"Opening evidence video for {result.target_camera_id or 'the flagged camera'}.",
            "opened_evidence_video",
        ),
        "watch_live": ("Switching to live feed.", "switched_to_live"),
        "replay_last_10_seconds": ("Replaying last 10 seconds.", "replayed_clip"),
        "send_floor_associate": ("Dispatching a floor associate.", "dispatched_associate"),
        "mark_false_alarm": ("Marking as false alarm. Alert cleared.", "marked_false_alarm"),
        "create_report": ("Creating review report.", "created_report"),
        "unknown": ("Command not recognised. Please repeat.", "none"),
    }
    response, action_taken = responses.get(result.command, ("Command not recognised.", "none"))
    return {"response": response, "action_taken": action_taken}


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
