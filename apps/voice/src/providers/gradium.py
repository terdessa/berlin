from __future__ import annotations

import asyncio
import io
import os
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Any, AsyncIterator


DEFAULT_GRADIUM_TTS_MODEL = "default"
DEFAULT_GRADIUM_STT_MODEL = "default"
DEFAULT_GRADIUM_STT_CHUNK_BYTES = 64 * 1024


@dataclass(frozen=True)
class GradiumTranscription:
    text: str
    messages: list[Any]


@dataclass(frozen=True)
class GradiumSynthesis:
    audio: bytes
    output_path: str | None
    sample_rate: int | None
    request_id: str | None
    output_format: str


class GradiumVoiceProvider:
    """
    Thin adapter over the official Gradium Python SDK.

    The SDK reads GRADIUM_API_KEY when api_key is omitted. TTS uses
    GRADIUM_VOICE_ID when voice_id is omitted; if neither is set, Gradium's
    service default is used by the LiveKit plugin, while direct SDK TTS raises
    a clear error so batch tools do not silently produce the wrong voice.
    """

    def __init__(
        self,
        *,
        api_key: str | None = None,
        voice_id: str | None = None,
        client: Any | None = None,
    ) -> None:
        self.api_key = api_key or _env("GRADIUM_API_KEY")
        self.voice_id = voice_id or _env("GRADIUM_VOICE_ID")
        self._client = client

    @property
    def client(self) -> Any:
        if self._client is None:
            try:
                import gradium
            except ImportError as exc:
                raise RuntimeError(
                    "Gradium SDK is not installed. Run `pip install -r apps/voice/requirements.txt`."
                ) from exc

            if self.api_key:
                self._client = gradium.client.GradiumClient(api_key=self.api_key)
            else:
                self._client = gradium.client.GradiumClient()
        return self._client

    async def transcribe_wav(
        self,
        audio_path: str | Path,
        *,
        model_name: str = DEFAULT_GRADIUM_STT_MODEL,
        language: str | None = None,
        delay_in_frames: int | None = None,
    ) -> GradiumTranscription:
        """
        Transcribe a WAV file through Gradium STT.

        Gradium accepts PCM WAV input directly. Some browser/phone-produced
        WAV files use WAVE_FORMAT_EXTENSIBLE headers, so normalize the RIFF
        header to standard PCM before streaming. The returned message shape may
        vary by SDK version; text extraction is intentionally permissive.
        """

        path = Path(audio_path)
        setup: dict[str, Any] = {
            "model_name": model_name,
            "input_format": "wav",
        }
        json_config: dict[str, Any] = {}
        if language:
            json_config["language"] = language
        if delay_in_frames is not None:
            json_config["delay_in_frames"] = delay_in_frames
        if json_config:
            setup["json_config"] = json_config

        stream = await self.client.stt_stream(setup, _read_bytes_chunks(_pcm_wav_bytes(path)))
        messages: list[Any] = []
        texts: list[str] = []
        async for message in stream.iter_text():
            messages.append(message)
            text = _message_text(message)
            if text:
                texts.append(text)

        return GradiumTranscription(text=_join_transcript(texts), messages=messages)

    def transcribe_wav_file(
        self,
        audio_path: str | Path,
        *,
        model_name: str = DEFAULT_GRADIUM_STT_MODEL,
        language: str | None = None,
        delay_in_frames: int | None = None,
    ) -> str:
        return _run_async(
            self.transcribe_wav(
                audio_path,
                model_name=model_name,
                language=language,
                delay_in_frames=delay_in_frames,
            )
        ).text

    async def synthesize_tts(
        self,
        text: str,
        *,
        output_path: str | Path | None = None,
        voice_id: str | None = None,
        model_name: str = DEFAULT_GRADIUM_TTS_MODEL,
        output_format: str = "wav",
    ) -> GradiumSynthesis:
        selected_voice_id = voice_id or self.voice_id
        if not selected_voice_id:
            raise RuntimeError("GRADIUM_VOICE_ID is required for direct Gradium SDK TTS synthesis.")

        result = await self.client.tts(
            setup={
                "model_name": model_name,
                "voice_id": selected_voice_id,
                "output_format": output_format,
            },
            text=text,
        )
        audio = bytes(result.raw_data)
        written_path: str | None = None
        if output_path is not None:
            path = Path(output_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(audio)
            written_path = str(path)

        return GradiumSynthesis(
            audio=audio,
            output_path=written_path,
            sample_rate=getattr(result, "sample_rate", None),
            request_id=getattr(result, "request_id", None),
            output_format=output_format,
        )

    def synthesize_tts_file(
        self,
        text: str,
        output_path: str | Path,
        *,
        voice_id: str | None = None,
        model_name: str = DEFAULT_GRADIUM_TTS_MODEL,
        output_format: str = "wav",
    ) -> GradiumSynthesis:
        return _run_async(
            self.synthesize_tts(
                text,
                output_path=output_path,
                voice_id=voice_id,
                model_name=model_name,
                output_format=output_format,
            )
        )


async def _read_chunks(path: Path) -> AsyncIterator[bytes]:
    with path.open("rb") as audio_file:
        while True:
            chunk = audio_file.read(DEFAULT_GRADIUM_STT_CHUNK_BYTES)
            if not chunk:
                break
            yield chunk


async def _read_bytes_chunks(data: bytes) -> AsyncIterator[bytes]:
    for start in range(0, len(data), DEFAULT_GRADIUM_STT_CHUNK_BYTES):
        yield data[start : start + DEFAULT_GRADIUM_STT_CHUNK_BYTES]


def _pcm_wav_bytes(path: Path) -> bytes:
    with wave.open(str(path), "rb") as source:
        channels = source.getnchannels()
        sample_width = source.getsampwidth()
        frame_rate = source.getframerate()
        frame_count = source.getnframes()
        frames = source.readframes(frame_count)

    output = io.BytesIO()
    with wave.open(output, "wb") as normalized:
        normalized.setnchannels(channels)
        normalized.setsampwidth(sample_width)
        normalized.setframerate(frame_rate)
        normalized.writeframes(frames)
    return output.getvalue()


def _message_text(message: Any) -> str:
    if isinstance(message, str):
        return message.strip()
    if isinstance(message, dict):
        for key in ("text", "transcript"):
            value = message.get(key)
            if isinstance(value, str):
                return value.strip()
        return ""
    for attr in ("text", "transcript"):
        value = getattr(message, attr, None)
        if isinstance(value, str):
            return value.strip()
    return ""


def _join_transcript(texts: list[str]) -> str:
    deduped: list[str] = []
    for text in texts:
        if not deduped or deduped[-1] != text:
            deduped.append(text)
    return " ".join(deduped).strip()


def _run_async(awaitable: Any) -> Any:
    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(awaitable)
    close = getattr(awaitable, "close", None)
    if callable(close):
        close()
    raise RuntimeError("Use the async GradiumVoiceProvider method inside an existing event loop.")


def _env(name: str) -> str | None:
    value = os.getenv(name, "").strip()
    return value or None
