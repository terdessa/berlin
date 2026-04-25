from __future__ import annotations

import wave
from pathlib import Path
from threading import Lock

from livekit import rtc


class CapturingFrameProcessor(rtc.FrameProcessor[rtc.AudioFrame]):
    """
    Wrap another LiveKit audio processor and keep raw/enhanced PCM snapshots.

    Raw bytes are captured before ai-coustics. Enhanced bytes are captured after
    ai-coustics. Each interaction record can then point to real WAV files.
    """

    def __init__(self, inner: rtc.FrameProcessor[rtc.AudioFrame]) -> None:
        self._inner = inner
        self._raw = bytearray()
        self._enhanced = bytearray()
        self._sample_rate = 16000
        self._num_channels = 1
        self._lock = Lock()

    @property
    def enabled(self) -> bool:
        return self._inner.enabled

    @enabled.setter
    def enabled(self, value: bool) -> None:
        self._inner.enabled = value

    def _on_stream_info_updated(
        self,
        *,
        room_name: str,
        participant_identity: str,
        publication_sid: str,
    ) -> None:
        self._inner._on_stream_info_updated(
            room_name=room_name,
            participant_identity=participant_identity,
            publication_sid=publication_sid,
        )

    def _on_credentials_updated(self, *, token: str, url: str) -> None:
        self._inner._on_credentials_updated(token=token, url=url)

    def _process(self, frame: rtc.AudioFrame) -> rtc.AudioFrame:
        with self._lock:
            self._sample_rate = frame.sample_rate
            self._num_channels = frame.num_channels
            self._raw.extend(bytes(frame.data))

        enhanced = self._inner._process(frame)

        with self._lock:
            self._enhanced.extend(bytes(enhanced.data))
        return enhanced

    def _close(self) -> None:
        self._inner._close()

    def write_wav_snapshots(
        self,
        raw_path: str | Path,
        enhanced_path: str | Path,
    ) -> tuple[str, str]:
        """Write current buffers to WAV files and return the paths as strings."""
        with self._lock:
            raw_bytes = bytes(self._raw)
            enhanced_bytes = bytes(self._enhanced)
            sample_rate = self._sample_rate
            num_channels = self._num_channels
            self._raw.clear()
            self._enhanced.clear()

        raw = Path(raw_path)
        enhanced = Path(enhanced_path)
        raw.parent.mkdir(parents=True, exist_ok=True)
        enhanced.parent.mkdir(parents=True, exist_ok=True)
        _write_wav(raw, raw_bytes, sample_rate, num_channels)
        _write_wav(enhanced, enhanced_bytes, sample_rate, num_channels)
        return str(raw), str(enhanced)


def _write_wav(path: Path, pcm: bytes, sample_rate: int, num_channels: int) -> None:
    with wave.open(str(path), "wb") as f:
        f.setnchannels(num_channels)
        f.setsampwidth(2)  # LiveKit AudioFrame data is int16 PCM.
        f.setframerate(sample_rate)
        f.writeframes(pcm)
