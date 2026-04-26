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
  GRADIUM_API_KEY

The ai-coustics SDK key is configured in the LiveKit Cloud project (ai-coustics
integration) and pushed to the plugin at runtime — it is not read from .env.
"""

from __future__ import annotations

import asyncio
import datetime
import json
import logging
import os
import threading
import time
from pathlib import Path

import aiohttp
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent.parent / ".env")

from livekit import api as lk_api
from livekit.agents import (
    AgentSession,
    AutoSubscribe,
    JobContext,
    WorkerOptions,
    cli,
)
from livekit.agents.voice import Agent
from livekit.agents.voice.room_io import RoomInputOptions
from livekit.plugins import ai_coustics
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
from .providers.gradium import GradiumVoiceProvider
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

# The ai-coustics LiveKit plugin emits noisy ERROR/WARNING traces during
# normal participant churn (transient WS frames, model warm-up). They scare
# the demo audience without indicating a real failure, so silence them.
logging.getLogger("livekit.plugins.ai_coustics").setLevel(logging.CRITICAL + 1)

# Named dispatch: explicit-dispatch worker so the same agent process can be
# joined via `lk_api.CreateAgentDispatchRequest(agent_name=AGENT_NAME, room=...)`
# without LiveKit's auto-dispatch racing a stale anonymous dispatch.
AGENT_NAME = "sentinel"

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
You speak through the guard's earpiece on a walkie-talkie channel.

Rules:
- Be brief and clear. The guard is in a noisy store; replies are spoken aloud.
  Two or three short sentences, max ~45 words. No lists, no markdown, no
  apologies, no preamble such as "Sure" or "Let me explain".
- Never say "thief", "criminal", "stealing", or make identity claims.
- Describe only observable behavior. Avoid inferring intent.
- Do NOT say "human review recommended", "requires review", or similar
  hand-off phrases by default. Only say a human review is needed when the
  guard asks something you genuinely cannot answer from the camera frame —
  for example a security policy question, an identity question, or a
  decision that requires human judgement. In that single case, say so
  briefly and stop.
- The ALERT FIRED line in the user message is context for you only; it has
  already been spoken to the guard once when the trigger fired. Do NOT restate
  it. When the guard asks "what happened", "what is going on", "describe the
  scene", "what do you see", or similar, answer using the attached camera
  frame. Lead with the most important thing (the person and what they are
  holding or doing), then add one short useful detail — appearance cue you
  can observe without identifying anyone (clothing colour, position in
  frame, the object held, body posture, or where they appear to be heading).
  Keep it concrete and natural, not a checklist. If the frame is unclear or
  missing, say so honestly in one sentence instead of inventing details.
- For action commands (open camera, switch camera, watch live, replay last 10
  seconds, pause video, resume playback, zoom in, follow that person, show
  previous alert, flag suspicious, call backup, send floor associate, mark
  false alarm, create report), reply with one short "done" style confirmation.
- If the guard references a camera that doesn't match the active alert (e.g.
  asks about CAM-02 while the alert is on CAM-03), assume the transcript may
  have miscaptured and ask one short clarification question, e.g.
  "Did you mean CAM-03, where the alert just fired?"
- If the guard's command is otherwise unclear, ask one short clarification
  question instead of guessing — never produce an "Error report" sentence.
- Before any visual alert arrives, there is no active scene; if the guard
  asks, say so calmly in one sentence.
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
        self.current_frame_base64: str | None = None
        self.current_frame_mime: str = "image/jpeg"
        # Cached snapshot of the audio for the current utterance — populated by
        # the dual-pass STT path so write_success/_failure don't re-snapshot
        # (which would clear the PCM buffers and produce empty WAVs).
        self._cached_audio: AudioMeasurement | None = None
        self._cached_audio_paths: tuple[str, str] | None = None

    def add_assistant_turn(self, text: str):
        self.conversation.append(ConversationTurn(speaker="assistant", text=text))

    def add_guard_turn(self, raw: str, enhanced: str, asr_confidence: float):
        self.conversation.append(ConversationTurn(
            speaker="guard",
            raw_transcript=raw,
            enhanced_transcript=enhanced,
            asr_confidence=asr_confidence,
        ))

    def replace_visual_event(
        self,
        visual_event: VisualEvent,
        *,
        frame_base64: str | None = None,
        frame_mime: str = "image/jpeg",
    ):
        self.visual_event = visual_event
        self.interaction_id = f"interaction-{datetime.datetime.utcnow().isoformat()}Z-{visual_event.camera_id}"
        self.timestamp = datetime.datetime.utcnow().isoformat() + "Z"
        self.conversation = []
        self.clarification_count = 0
        if frame_base64:
            self.current_frame_base64 = frame_base64
            self.current_frame_mime = frame_mime or "image/jpeg"

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

    def snapshot_audio_now(self) -> tuple[AudioMeasurement, tuple[str, str]]:
        """
        Snapshot raw + enhanced WAVs and score NISQA, caching the result for
        write_success/_failure. Idempotent within a turn — calling twice
        returns the same paths and the same NISQA scores instead of taking a
        second (empty) snapshot.
        """
        if self._cached_audio is not None and self._cached_audio_paths is not None:
            return self._cached_audio, self._cached_audio_paths
        raw_path, enhanced_path, raw_clip_path, enhanced_clip_path = self.save_audio()
        nisqa = score_pair(raw_path, enhanced_path)
        measurement = AudioMeasurement(
            raw_clip_path=raw_clip_path,
            enhanced_clip_path=enhanced_clip_path,
            nisqa=nisqa,
        )
        self._cached_audio = measurement
        self._cached_audio_paths = (raw_path, enhanced_path)
        return measurement, self._cached_audio_paths

    def consume_audio_snapshot(self) -> tuple[AudioMeasurement, tuple[str, str]]:
        """
        Return the cached snapshot if present, else snapshot now. Resets the
        cache so the *next* utterance gets a fresh measurement.
        """
        measurement, paths = self.snapshot_audio_now()
        self._cached_audio = None
        self._cached_audio_paths = None
        return measurement, paths

    def write_success(self, result: InterpretResult, action_taken: str):
        audio, _ = self.consume_audio_snapshot()
        nisqa = audio.nisqa
        record = InteractionRecord(
            id=self.interaction_id,
            timestamp=self.timestamp,
            outcome="success",
            visual_event=self.visual_event,
            audio=audio,
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
        audio, _ = self.consume_audio_snapshot()
        nisqa = audio.nisqa
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
            audio=audio,
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
            await ctx.room.local_participant.publish_data(
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
        # The session may briefly be torn down (e.g. participant_disconnected
        # while the phone reloads). Skip TTS in that window instead of raising
        # — the dashboard still gets the assistant_turn data packet below.
        activity = getattr(agent_session, "_activity", None)
        if activity is None:
            log.warning(
                "sentinel say: skipping TTS, AgentSession not running yet — text=%r",
                text,
            )
        else:
            try:
                agent_session.say(text, allow_interruptions=True)
                log.info("sentinel say: %r", text)
            except RuntimeError as err:
                log.warning("agent_session.say() not ready: %s — text=%r", err, text)
            except Exception:
                log.exception("agent_session.say() failed for text=%r", text)
        publish_event("assistant_turn", {"text": text})

    # ----- Trailing-silence debounce -----
    # Gradium STT finalizes on every VAD-detected silence, so one press of
    # the dashboard's "hold to talk" button can produce >1 guard turns. We
    # buffer each final and flush them as a single utterance after a short
    # window of silence (no client framing protocol required — the press
    # itself just gates whether audio reaches STT).
    SILENCE_FLUSH_S = float(os.getenv("SENTINEL_UTTERANCE_SILENCE_MS", "350")) / 1000.0
    utterance_buffer: list[tuple[str, str, float]] = []  # (raw, enhanced, conf)
    utterance_flush_task: asyncio.Task | None = None

    gradium_voice = GradiumVoiceProvider()

    async def _transcribe_raw_wav(path: str) -> str:
        """
        Run Gradium STT on the un-enhanced (pre-ai-coustics) WAV. This is the
        second of the dual-pass: the agent's normal STT already got the
        enhanced stream, so this gives us a raw-vs-enhanced text comparison
        using the same vendor on the same audio range.
        """
        try:
            transcription = await gradium_voice.transcribe_wav(path)
            return transcription.text.strip()
        except Exception:
            log.exception("dual-pass: raw STT failed for %s", path)
            return ""

    async def _flush_utterance() -> None:
        nonlocal utterance_buffer, utterance_flush_task
        try:
            await asyncio.sleep(SILENCE_FLUSH_S)
        except asyncio.CancelledError:
            return
        finally:
            utterance_flush_task = None
        if not utterance_buffer:
            return
        enhanceds = [e for _, e, _ in utterance_buffer]
        confs = [c for _, _, c in utterance_buffer]
        utterance_buffer = []
        merged_enhanced = " ".join(enhanceds).strip()
        if not merged_enhanced:
            return
        merged_conf = min(confs) if confs else 1.0

        # Snapshot raw + enhanced PCM to WAV NOW (before any STT call clears the
        # buffers in a future turn) and run dual-pass STT on the raw clip.
        audio_measurement, audio_paths = session.snapshot_audio_now()
        raw_wav_path, _ = audio_paths
        raw_transcript_task = asyncio.create_task(_transcribe_raw_wav(raw_wav_path))

        delta_mos = round(audio_measurement.nisqa.delta.mos, 2)

        # Publish the guard turn to the dashboard IMMEDIATELY with the enhanced
        # transcript (used as the raw placeholder). Waiting for dual-pass raw
        # STT before showing anything on the dashboard added 1–4 s of perceived
        # latency between the guard releasing the talk button and seeing their
        # words appear. Raw STT completes in the background and the corpus
        # record below uses the real raw transcript.
        session.add_guard_turn(merged_enhanced, merged_enhanced, merged_conf)
        publish_event(
            "guard_turn",
            {
                "rawTranscript": merged_enhanced,
                "enhancedTranscript": merged_enhanced,
                "asrConfidence": merged_conf,
                "nisqaDeltaMos": delta_mos,
                "nisqaRawMos": round(audio_measurement.nisqa.raw.mos, 2),
                "nisqaEnhancedMos": round(audio_measurement.nisqa.enhanced.mos, 2),
                "transcriptsDiffer": False,
            },
        )

        # Kick off Gemini reply in parallel with raw STT — they don't depend
        # on each other, and the reply latency dominates. Tight timeout on raw
        # STT (1 s) keeps the corpus accurate without stalling the pipeline.
        handle_task = asyncio.create_task(
            _handle_guard_speech(merged_enhanced, merged_enhanced, merged_conf)
        )
        try:
            merged_raw = await asyncio.wait_for(raw_transcript_task, timeout=1.0)
        except asyncio.TimeoutError:
            log.warning("dual-pass: raw STT timed out; falling back to enhanced text")
            merged_raw = merged_enhanced
        if not merged_raw:
            merged_raw = merged_enhanced

        log.info(
            "utterance: flush — enhanced=%r raw=%r ΔMOS=%+.2f",
            merged_enhanced,
            merged_raw,
            delta_mos,
        )

        # Patch the conversation turn that we already published so the corpus
        # record carries the correct raw vs enhanced split.
        if session.conversation and session.conversation[-1].speaker == "guard":
            session.conversation[-1].raw_transcript = merged_raw

        await handle_task

    def _reschedule_flush() -> None:
        nonlocal utterance_flush_task
        if utterance_flush_task and not utterance_flush_task.done():
            utterance_flush_task.cancel()
        utterance_flush_task = asyncio.create_task(_flush_utterance())

    spoken_visual_event_ids: set[str] = set()
    last_spoken_at_per_camera: dict[str, float] = {}
    # Backstop only — the dashboard now sends a stable eventId per page-load
    # so the per-id dedupe above is the primary gate. Set high enough that a
    # second dashboard tab or a re-publish won't accidentally re-trigger.
    CAMERA_ALERT_COOLDOWN_S = 3600.0

    def handle_visual_alert(payload: dict):
        visual_event = _visual_event_from_payload(payload)
        if not visual_event:
            log.warning("ignored malformed visual alert payload", extra={"payload": payload})
            return

        if visual_event.id in spoken_visual_event_ids:
            return
        spoken_visual_event_ids.add(visual_event.id)

        now = time.monotonic()
        last_at = last_spoken_at_per_camera.get(visual_event.camera_id, 0.0)
        if now - last_at < CAMERA_ALERT_COOLDOWN_S:
            log.info(
                "dropped duplicate alert within %.1fs cooldown for camera=%s id=%s",
                CAMERA_ALERT_COOLDOWN_S,
                visual_event.camera_id,
                visual_event.id,
            )
            return
        last_spoken_at_per_camera[visual_event.camera_id] = now

        frame_base64, frame_mime = _frame_from_payload(payload)
        session.replace_visual_event(
            visual_event,
            frame_base64=frame_base64,
            frame_mime=frame_mime,
        )
        alert_text = _alert_text_for_visual_event(visual_event)
        session.add_assistant_turn(alert_text)
        publish_event("visual_event", _visual_event_to_dict(visual_event))
        say(alert_text)

    @ctx.room.on("data_received")
    def on_visual_alert_packet(data_packet):
        topic = getattr(data_packet, "topic", None)
        sender = getattr(getattr(data_packet, "participant", None), "identity", None)
        log.info("data_received: topic=%r sender=%r", topic, sender)

        if topic not in {"sentinel.visual-alert", "sentinel.voice"}:
            log.info("data_received: ignored — unexpected topic %r", topic)
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

        source = envelope.get("source")
        kind = envelope.get("kind")
        if source == "sentinel-voice-agent":
            return

        if kind != "visual_event":
            log.info("data_received: ignored — kind=%r source=%r", kind, source)
            return

        payload = envelope.get("payload")
        if not isinstance(payload, dict):
            log.warning("data_received: payload missing or not a dict: %r", payload)
            return

        log.info(
            "visual_event received: id=%s camera=%s zone=%s summary=%r confidence=%s frame=%s",
            payload.get("id"),
            payload.get("cameraId"),
            payload.get("zone"),
            payload.get("summary"),
            payload.get("confidence"),
            "yes" if payload.get("frameBase64") else "no",
        )
        handle_visual_alert(payload)

    async def _handle_guard_speech(raw_text: str, enhanced_text: str, asr_confidence: float):
        result = interpret(enhanced_text, camera_id=session.visual_event.camera_id)

        try:
            reply = await _gemini_reply(enhanced_text, session)
        except Exception:
            log.exception("gemini reply failed; falling back to canned route response")
            reply = _route_command(result, session.visual_event)["response"]

        session.add_assistant_turn(reply)
        say(reply)

        if result.confidence >= ACTION_THRESHOLD:
            action_taken = _route_command(result, session.visual_event)["action_taken"]
            record = session.write_success(result, action_taken)
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
            else:
                record = session.write_failure(
                    result,
                    raw_text,
                    enhanced_text,
                    reason="voice_command_unclear",
                    action_taken="asked_for_clarification",
                )
        publish_event("interaction_record", record.to_dict())

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

        # Buffer every final and flush after SILENCE_FLUSH_S of quiet — that's
        # the canonical path. If the guard's release races the last STT final,
        # the trailing final still lands inside the window and gets merged.
        utterance_buffer.append((raw_text, enhanced_text, asr_confidence))
        log.info(
            "utterance: buffered final (now %d): %r",
            len(utterance_buffer),
            enhanced_text,
        )
        _reschedule_flush()

    # Wire ai-coustics noise cancellation on the incoming guard audio.
    mic_identity = os.getenv("LIVEKIT_MIC_IDENTITY", "").strip() or "sentinel-guard-mic"
    log.info("entrypoint: about to call agent_session.start(mic_identity=%s)", mic_identity)
    await agent_session.start(
        agent,
        room=ctx.room,
        room_input_options=RoomInputOptions(
            participant_identity=mic_identity,
            noise_cancellation=audio_processor,
            # Keep the session alive when the phone reloads /audio or briefly
            # drops; otherwise the next visual-alert packet hits a torn-down
            # session with "AgentSession isn't running".
            close_on_disconnect=False,
        ),
    )
    log.info(
        "entrypoint: agent_session.start() returned. started=%s activity=%s",
        getattr(agent_session, "_started", "?"),
        "set" if getattr(agent_session, "_activity", None) is not None else "None",
    )
    # Block forever — entrypoint must not return until the framework signals shutdown,
    # otherwise once we drop out of this coroutine the AgentSession's job-shutdown
    # callback fires (`_aclose_impl` clears `_activity`), which causes any later
    # `say()` from a data_received handler to raise "AgentSession isn't running".
    await asyncio.Future()


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


def _frame_from_payload(payload: dict) -> tuple[str | None, str]:
    """Extract a base64 frame (and its MIME type) from a visual-alert payload."""
    raw = payload.get("frameBase64") or payload.get("frame_base64")
    if not isinstance(raw, str) or len(raw) < 200:
        return None, "image/jpeg"
    mime = "image/jpeg"
    if raw.startswith("data:"):
        head, _, tail = raw.partition(",")
        if ";" in head:
            mime = head[5 : head.index(";")] or mime
        raw = tail
    payload_mime = payload.get("frameMimeType") or payload.get("frame_mime_type")
    if isinstance(payload_mime, str) and payload_mime.strip():
        mime = payload_mime.strip().split(";")[0]
    return raw, mime


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
    summary = (visual_event.summary or "").lower()
    if "item" in summary or "shelf" in summary or "palm" in summary:
        return f"Alert. An item appears taken from shelf on {visual_event.camera_id}. Please review."
    return (
        f"Alert. {visual_event.zone} requires review. "
        f"{visual_event.summary} Human review recommended."
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


def _trigger_description(summary: str) -> str:
    """Translate the dashboard's terse summary into one plain-language trigger sentence."""
    s = (summary or "").strip().lower()
    if "palm" in s:
        return "An open palm was deliberately shown to the camera (review trigger gesture)."
    if not s:
        return "Dashboard flagged a moment for review."
    return summary.strip().rstrip(".") + "."


GEMINI_MODEL = "gemini-2.5-flash-lite"
GEMINI_ENDPOINT = (
    f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"
)
_GEMINI_HISTORY_TURNS = 8


async def _gemini_reply(transcript: str, session: "SentinelSession") -> str:
    """Send the latest guard transcript to Gemini and return the spoken reply."""
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is required for the Sentinel voice agent reply path.")

    visual = session.visual_event
    has_active_event = visual.id != "event-none" and bool(visual.summary)
    if has_active_event:
        trigger = _trigger_description(visual.summary)
        frame_note = (
            "A camera frame from the moment of the trigger is attached."
            if session.current_frame_base64
            else "No camera frame is attached for this trigger."
        )
        visual_context = (
            f"ALERT FIRED: {trigger}\n"
            f"- camera: {visual.camera_id}\n"
            f"- zone: {visual.zone}\n"
            f"- raw summary: {visual.summary}\n"
            f"- confidence: {round(visual.confidence * 100)}%\n"
            f"- {frame_note}"
        )
    else:
        visual_context = "No active visual alert. The dashboard has not triggered anything yet."

    contents: list[dict] = []
    history_tail = session.conversation[-_GEMINI_HISTORY_TURNS:]
    for turn in history_tail:
        text = turn.text or turn.enhanced_transcript or turn.raw_transcript or ""
        text = text.strip()
        if not text:
            continue
        role = "model" if turn.speaker == "assistant" else "user"
        contents.append({"role": role, "parts": [{"text": text}]})

    user_parts: list[dict] = [
        {"text": f"{visual_context}\n\nGuard said: {transcript}"},
    ]
    if session.current_frame_base64:
        user_parts.append(
            {
                "inlineData": {
                    "mimeType": session.current_frame_mime,
                    "data": session.current_frame_base64,
                }
            }
        )
    contents.append({"role": "user", "parts": user_parts})

    body = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": contents,
        "generationConfig": {
            "temperature": 0.3,
            "maxOutputTokens": 220,
        },
    }

    timeout = aiohttp.ClientTimeout(total=15)
    async with aiohttp.ClientSession(timeout=timeout) as http:
        async with http.post(
            GEMINI_ENDPOINT,
            headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
            json=body,
        ) as resp:
            payload = await resp.json()
            if resp.status >= 400:
                raise RuntimeError(
                    f"gemini {resp.status}: {payload.get('error', {}).get('message', 'unknown error')}"
                )

    parts = (
        payload.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [])
    )
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        raise RuntimeError("gemini returned an empty response")
    return text


def _start_self_dispatch_thread() -> None:
    """
    Fire a one-shot agent dispatch into LIVEKIT_ROOM after the worker registers,
    so opening /audio finds the agent already in the room without a second
    terminal running `python -m src.dispatch_agent`.
    """

    room = os.getenv("LIVEKIT_ROOM", "sentinel-live")
    url = os.getenv("LIVEKIT_URL")
    key = os.getenv("LIVEKIT_API_KEY")
    secret = os.getenv("LIVEKIT_API_SECRET")
    if not (url and key and secret):
        return

    def _runner() -> None:
        time.sleep(3)

        async def _dispatch() -> None:
            client = lk_api.LiveKitAPI(url, key, secret)
            try:
                # Ensure the room exists — list_dispatch / create_dispatch both
                # 404 if no participant has joined yet. CreateRoom is idempotent.
                try:
                    await client.room.create_room(
                        lk_api.CreateRoomRequest(name=room, empty_timeout=24 * 60 * 60)
                    )
                    log.info("self-dispatch: ensured room exists name=%s", room)
                except Exception:
                    log.warning("self-dispatch: create_room failed (continuing)", exc_info=True)
                existing = await client.agent_dispatch.list_dispatch(room_name=room)
                # Stale dispatches from prior worker processes (or with a
                # different/empty agent_name) won't route jobs to *this*
                # worker. Drop them so the create below can target our name.
                stale = [d for d in existing if d.agent_name != AGENT_NAME]
                for d in stale:
                    try:
                        await client.agent_dispatch.delete_dispatch(d.id, room)
                        log.info(
                            "self-dispatch: dropped stale dispatch id=%s agent_name=%r",
                            d.id,
                            d.agent_name,
                        )
                    except Exception:
                        log.warning(
                            "self-dispatch: failed to drop stale dispatch id=%s",
                            d.id,
                            exc_info=True,
                        )
                already_mine = [d for d in existing if d.agent_name == AGENT_NAME]
                if already_mine:
                    log.info(
                        "self-dispatch: %d active dispatch(es) for agent_name=%r already in room=%s; reusing",
                        len(already_mine),
                        AGENT_NAME,
                        room,
                    )
                    return
                dispatch = await client.agent_dispatch.create_dispatch(
                    lk_api.CreateAgentDispatchRequest(room=room, agent_name=AGENT_NAME)
                )
                log.info(
                    "self-dispatched agent into room=%s id=%s agent_name=%r",
                    room,
                    dispatch.id,
                    AGENT_NAME,
                )
            except Exception:
                log.warning(
                    "self-dispatch failed",
                    exc_info=True,
                )
            finally:
                await client.aclose()

        try:
            asyncio.run(_dispatch())
        except Exception:
            log.exception("self-dispatch thread crashed")

    threading.Thread(target=_runner, name="sentinel-self-dispatch", daemon=True).start()


def _build_agent_session() -> AgentSession:
    """
    Build the Gradium STT/TTS session.

    ai-coustics stays in RoomInputOptions below, so the guard mic enhancement
    path remains separate from the voice runtime.
    """

    if not os.getenv("GRADIUM_API_KEY"):
        raise RuntimeError("GRADIUM_API_KEY is required for the Sentinel voice agent.")
    if lk_gradium is None:
        raise RuntimeError(
            "livekit.plugins.gradium is unavailable; install livekit-agents[gradium]."
        )

    # `vad_bucket` is an INDEX into Gradium's per-step `data["vad"]` array
    # (look-ahead window selector — higher = longer look-ahead = more
    # conservative end-of-utterance). The plugin returns ~3 buckets, so
    # anything > 2 raises IndexError. Bucket 2 with a stricter
    # `vad_threshold` keeps "what do you see on the screen?" as one final
    # utterance instead of splitting at the natural in-sentence pause that
    # `vad_threshold=0.6, vad_bucket=1` was finalizing on.
    vad_threshold = float(os.getenv("SENTINEL_VAD_THRESHOLD", "0.6"))
    vad_bucket = int(os.getenv("SENTINEL_VAD_BUCKET", "1"))
    return AgentSession(
        stt=lk_gradium.STT(vad_threshold=vad_threshold, vad_bucket=vad_bucket),
        tts=lk_gradium.TTS(),
    )


if __name__ == "__main__":
    _start_self_dispatch_thread()
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            agent_name=AGENT_NAME,
        )
    )
