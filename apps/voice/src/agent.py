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
  GRADIUM_API_KEY, GRADIUM_VOICE_ID  (preferred STT/TTS runtime)
  OPENAI_API_KEY  (fallback STT/TTS if Gradium plugin is unavailable)
"""

from __future__ import annotations

import asyncio
import datetime
import json
import logging
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent.parent / ".env")
if not os.getenv("GRADIUM_API_KEY") and os.getenv("TELLI_API_KEY"):
    os.environ["GRADIUM_API_KEY"] = os.environ["TELLI_API_KEY"]

from livekit.agents import (
    AgentSession,
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
)
from livekit.agents.voice import Agent
from livekit.agents.voice.room_io import RoomInputOptions
from livekit.plugins import openai as lk_openai
from livekit.plugins import ai_coustics
from livekit.plugins import silero
from livekit.plugins.ai_coustics import EnhancerModel

try:
    from livekit.plugins import gradium as lk_gradium
except ImportError:
    lk_gradium = None

from .audio_capture import CapturingFrameProcessor
from .interpret import (
    ACTION_THRESHOLD,
    MAX_CLARIFICATIONS,
    InterpretResult,
    failure_explanation,
    interpret,
)
from .schema import (
    AudioMeasurement,
    ConversationTurn,
    FailureRecord,
    Interpretation,
    InteractionRecord,
    VisualEvent,
)
from . import logger as corpus_logger
from .nisqa import score_pair

log = logging.getLogger("sentinel.voice")

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
# Default visual context used before Gemini sends the first live alert.
# ---------------------------------------------------------------------------

DEFAULT_VISUAL_EVENT = VisualEvent(
    id="event-none",
    camera_id="CAM-03",
    zone="Moving camera",
    summary="No active visual alert yet.",
    confidence=0.0,
    frame_url=None,
    clip_url=None,
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
- Supported commands you can execute: open camera, switch camera, watch live,
  replay last 10 seconds, pause video, resume playback, zoom in, follow that
  person, show previous alert, what happened there, flag suspicious, call backup, send floor
  associate, mark false alarm, create report.
- If the guard's command is unclear, say exactly:
  "I didn't catch that clearly. Did you mean [your best guess]?"
- Current state: no active visual alert yet. When a visual alert arrives, speak
  it to the guard and answer follow-up questions using that latest camera context.
""".strip()

# ---------------------------------------------------------------------------
# Session state per call
# ---------------------------------------------------------------------------

class SentinelSession:
    def __init__(self, visual_event: VisualEvent, audio_processor: CapturingFrameProcessor):
        self.visual_event = visual_event
        self.audio_processor = audio_processor
        self.conversation: list[ConversationTurn] = []
        self.clarification_count = 0
        self.interaction_id = f"interaction-{datetime.datetime.utcnow().isoformat()}Z-{visual_event.camera_id}"
        self.timestamp = datetime.datetime.utcnow().isoformat() + "Z"

    def add_assistant_turn(self, text: str):
        self.conversation.append(ConversationTurn(speaker="assistant", text=text))

    def add_guard_turn(self, raw: str, enhanced: str, asr_confidence: float):
        self.conversation.append(ConversationTurn(
            speaker="guard",
            raw_transcript=raw,
            enhanced_transcript=enhanced,
            asr_confidence=asr_confidence,
        ))

    def replace_visual_event(self, visual_event: VisualEvent):
        self.visual_event = visual_event
        self.interaction_id = f"interaction-{datetime.datetime.utcnow().isoformat()}Z-{visual_event.camera_id}"
        self.timestamp = datetime.datetime.utcnow().isoformat() + "Z"
        self.conversation = []
        self.clarification_count = 0

    def save_audio(self) -> tuple[str, str, str, str]:
        ts = datetime.datetime.utcnow().isoformat().replace(":", "-").replace(".", "-") + "Z"
        raw_name = f"{ts}.wav"
        enhanced_name = f"{ts}.wav"
        raw_path = _AUDIO_RAW / raw_name
        enhanced_path = _AUDIO_ENHANCED / enhanced_name
        self.audio_processor.write_wav_snapshots(raw_path, enhanced_path)
        return (
            str(raw_path),
            str(enhanced_path),
            f"audio/raw/{raw_name}",
            f"audio/enhanced/{enhanced_name}",
        )

    def write_success(self, result: InterpretResult, action_taken: str):
        raw_path, enhanced_path, raw_clip_path, enhanced_clip_path = self.save_audio()
        nisqa = score_pair(raw_path, enhanced_path)
        record = InteractionRecord(
            id=self.interaction_id,
            timestamp=self.timestamp,
            outcome="success",
            visual_event=self.visual_event,
            audio=AudioMeasurement(
                raw_clip_path=raw_clip_path,
                enhanced_clip_path=enhanced_clip_path,
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
        action_taken: str = "asked_for_clarification",
    ):
        raw_path, enhanced_path, raw_clip_path, enhanced_clip_path = self.save_audio()
        nisqa = score_pair(raw_path, enhanced_path)
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
                raw_clip_path=raw_clip_path,
                enhanced_clip_path=enhanced_clip_path,
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

    audio_processor = CapturingFrameProcessor(
        ai_coustics.audio_enhancement(
            model=EnhancerModel.QUAIL_L,
        )
    )

    session = SentinelSession(
        visual_event=DEFAULT_VISUAL_EVENT,
        audio_processor=audio_processor,
    )

    agent = Agent(instructions=SYSTEM_PROMPT)

    agent_session = _build_agent_session()

    def publish_event(kind: str, payload: dict):
        message = {
            "source": "sentinel-voice-agent",
            "kind": kind,
            "payload": payload,
        }
        async def _publish():
            ctx.room.local_participant.publish_data(
                json.dumps(message, ensure_ascii=False),
                reliable=True,
                topic="sentinel.voice",
            )

        task = asyncio.create_task(_publish())

        def _log_publish_failure(done: asyncio.Task):
            try:
                done.result()
            except Exception:
                log.exception("failed to publish Sentinel voice event", extra={"kind": kind})

        task.add_done_callback(_log_publish_failure)

    def say(text: str):
        agent_session.say(text, allow_interruptions=True)
        publish_event("assistant_turn", {"text": text})

    spoken_visual_event_ids: set[str] = set()

    def handle_visual_alert(payload: dict):
        visual_event = _visual_event_from_payload(payload)
        if not visual_event:
            log.warning("ignored malformed visual alert payload", extra={"payload": payload})
            return

        if visual_event.id in spoken_visual_event_ids:
            return
        spoken_visual_event_ids.add(visual_event.id)

        session.replace_visual_event(visual_event)
        alert_text = _alert_text_for_visual_event(visual_event)
        session.add_assistant_turn(alert_text)
        publish_event("visual_event", _visual_event_to_dict(visual_event))
        say(alert_text)

    @ctx.room.on("data_received")
    def on_visual_alert_packet(data_packet):
        if data_packet.topic not in {"sentinel.visual-alert", "sentinel.voice"}:
            return

        try:
            data = data_packet.data
            if isinstance(data, bytes):
                raw = data.decode("utf-8")
            else:
                raw = str(data)
            envelope = json.loads(raw)
        except Exception:
            log.exception("failed to parse LiveKit visual alert data packet")
            return

        if envelope.get("source") == "sentinel-voice-agent":
            return
        if envelope.get("kind") != "visual_event":
            return

        payload = envelope.get("payload")
        if not isinstance(payload, dict):
            return
        handle_visual_alert(payload)

    @agent_session.on("user_input_transcribed")
    def on_guard_speech(event):
        if not getattr(event, "is_final", False):
            return

        enhanced_text = event.transcript.strip()
        if not enhanced_text:
            return

        raw_text = getattr(event, "raw_transcript", enhanced_text)
        asr_confidence = getattr(event, "confidence", None)
        if asr_confidence is None:
            asr_confidence = 1.0

        session.add_guard_turn(raw_text, enhanced_text, asr_confidence)
        publish_event(
            "guard_turn",
            {
                "rawTranscript": raw_text,
                "enhancedTranscript": enhanced_text,
                "asrConfidence": asr_confidence,
            },
        )

        result = interpret(enhanced_text, camera_id=session.visual_event.camera_id)

        if result.confidence >= ACTION_THRESHOLD:
            action = _route_command(result, session.visual_event)
            session.add_assistant_turn(action["response"])
            say(action["response"])
            record = session.write_success(result, action["action_taken"])
            publish_event("interaction_record", record.to_dict())
        else:
            session.clarification_count += 1
            if session.clarification_count >= MAX_CLARIFICATIONS:
                record = session.write_failure(
                    result,
                    raw_text,
                    enhanced_text,
                    reason="max_clarifications_reached",
                    action_taken="none",
                )
                publish_event("interaction_record", record.to_dict())
                return

            clarification = (
                f"I didn't catch that clearly. "
                f"Did you mean {result.command.replace('_', ' ')} "
                f"at {session.visual_event.zone}?"
            )
            session.add_assistant_turn(clarification)
            say(clarification)
            record = session.write_failure(
                result,
                raw_text,
                enhanced_text,
                reason="voice_command_unclear",
                action_taken="asked_for_clarification",
            )
            publish_event("interaction_record", record.to_dict())

    # Wire ai-coustics noise cancellation on the incoming guard audio.
    mic_identity = os.getenv("LIVEKIT_MIC_IDENTITY", "").strip() or "sentinel-guard-mic"
    await agent_session.start(
        agent,
        room=ctx.room,
        room_input_options=RoomInputOptions(
            participant_identity=mic_identity,
            noise_cancellation=audio_processor,
        ),
    )


def _visual_event_from_payload(payload: dict) -> VisualEvent | None:
    event_id = str(payload.get("id") or f"event-{datetime.datetime.utcnow().isoformat()}Z")
    camera_id = str(payload.get("cameraId") or payload.get("camera_id") or "").strip()
    zone = str(payload.get("zone") or "").strip()
    summary = str(payload.get("summary") or "").strip()
    if not camera_id or not zone or not summary:
        return None

    confidence_raw = payload.get("confidence", 0.0)
    try:
        confidence = float(confidence_raw)
    except (TypeError, ValueError):
        confidence = 0.0

    return VisualEvent(
        id=event_id,
        camera_id=camera_id,
        zone=zone,
        summary=summary,
        confidence=max(0.0, min(1.0, confidence)),
        frame_url=payload.get("frameUrl") or payload.get("frame_url"),
        clip_url=payload.get("clipUrl") or payload.get("clip_url"),
    )


def _visual_event_to_dict(visual_event: VisualEvent) -> dict:
    return {
        "id": visual_event.id,
        "cameraId": visual_event.camera_id,
        "zone": visual_event.zone,
        "summary": visual_event.summary,
        "confidence": visual_event.confidence,
        "frameUrl": visual_event.frame_url,
        "clipUrl": visual_event.clip_url,
    }


def _alert_text_for_visual_event(visual_event: VisualEvent) -> str:
    return (
        f"Alert, alert. {visual_event.zone} requires review. "
        f"I noticed something on camera: {visual_event.summary} "
        "Human review recommended."
    )


def _route_command(result: InterpretResult, visual_event: VisualEvent | None = None) -> dict:
    """Map a classified command to a response string and action label."""
    event_zone = visual_event.zone if visual_event else "the active camera"
    event_summary = visual_event.summary if visual_event else "No current visual event is available."
    event_confidence = (
        f" Confidence {round(visual_event.confidence * 100)} percent."
        if visual_event and visual_event.confidence
        else ""
    )
    responses = {
        "open_camera": (
            f"Opening evidence video for {result.target_camera_id or 'the flagged camera'}.",
            "opened_evidence_video",
        ),
        "switch_camera": (
            f"Switching to {result.target_camera_id or 'the requested camera'}.",
            "switched_camera",
        ),
        "watch_live": ("Switching to live feed.", "switched_to_live"),
        "replay_last_10_seconds": ("Replaying last 10 seconds.", "replayed_clip"),
        "pause_video": ("Pausing the evidence video.", "paused_video"),
        "resume_playback": ("Resuming playback.", "resumed_playback"),
        "zoom_in": ("Zooming in on the review area.", "zoomed_in"),
        "flag_suspicious": ("Flag added for human review.", "flagged_suspicious"),
        "show_previous_alert": ("Showing the previous alert.", "showed_previous_alert"),
        "call_for_backup": ("Calling for backup.", "called_for_backup"),
        "follow_person": ("Following the camera sequence for review.", "followed_person"),
        "what_happened_there": (
            f"{event_zone}: {event_summary}{event_confidence}",
            "summarized_current_event",
        ),
        "send_floor_associate": ("Dispatching a floor associate.", "dispatched_associate"),
        "mark_false_alarm": ("Marking as false alarm. Alert cleared.", "marked_false_alarm"),
        "create_report": ("Creating review report.", "created_report"),
        "unknown": ("Command not recognised. Please repeat.", "none"),
    }
    response, action_taken = responses.get(result.command, ("Command not recognised.", "none"))
    return {"response": response, "action_taken": action_taken}


def _build_agent_session() -> AgentSession:
    """
    Prefer Gradium STT/TTS when its LiveKit plugin is installed.

    ai-coustics stays in RoomInputOptions below, so the guard mic enhancement
    path remains unchanged regardless of the voice runtime. The direct Gradium
    SDK adapter used by batch evaluation lives in src/providers/gradium.py.
    """

    if os.getenv("GRADIUM_API_KEY") and lk_gradium is not None:
        voice_id = os.getenv("GRADIUM_VOICE_ID", "").strip()
        try:
            tts_kwargs = {"voice_id": voice_id} if voice_id else {}
            return AgentSession(
                stt=lk_gradium.STT(vad_threshold=0.6, vad_bucket=1),
                tts=lk_gradium.TTS(**tts_kwargs),
            )
        except Exception:
            log.exception("failed to initialize Gradium LiveKit voice runtime; falling back to OpenAI")

    if os.getenv("GRADIUM_API_KEY") and lk_gradium is None:
        log.warning(
            "GRADIUM_API_KEY is set, but livekit.plugins.gradium is unavailable; "
            "install livekit-agents[gradium] to enable Gradium in the live agent"
        )

    return AgentSession(
        stt=lk_openai.STT(),
        tts=lk_openai.TTS(),
        vad=silero.VAD.load(),
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
