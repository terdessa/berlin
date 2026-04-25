"""
Append interaction records to the submission corpus (interactions.json).
Thread-safe for single-process use; sufficient for a hackathon demo.
"""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path

from .schema import InteractionRecord

_SUBMISSION_DIR = Path(__file__).parent.parent / "submission"
_CORPUS_PATH = _SUBMISSION_DIR / "interactions.json"

_lock = threading.Lock()


def _ensure_corpus() -> list:
    _SUBMISSION_DIR.mkdir(parents=True, exist_ok=True)
    if not _CORPUS_PATH.exists():
        _CORPUS_PATH.write_text("[]", encoding="utf-8")
        return []
    text = _CORPUS_PATH.read_text(encoding="utf-8").strip()
    if not text:
        return []
    return json.loads(text)


def append(record: InteractionRecord) -> None:
    """Append one interaction record to interactions.json."""
    with _lock:
        records = _ensure_corpus()
        records.append(record.to_dict())
        _CORPUS_PATH.write_text(
            json.dumps(records, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )


def load_all() -> list[dict]:
    """Return the full corpus as a list of dicts."""
    with _lock:
        return _ensure_corpus()


def corpus_path() -> Path:
    return _CORPUS_PATH
