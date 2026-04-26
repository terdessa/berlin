#!/usr/bin/env bash
# Reproducible Sentinel audio-intelligence benchmark.
#
# Run from the repo root or apps/voice (paths are computed relative to the
# script location). Activates the project venv, transcribes the dataset
# corpus through Gradium STT (raw vs. enhanced), computes SAIS components,
# and prints the headline summary table.
#
# Outputs land in:
#   apps/voice/submission/audio_dataset_transcripts.json
#   apps/voice/submission/audio_dataset_results.json
#   apps/voice/submission/audio_intelligence_results.json
#
# Usage:
#   ./apps/voice/scripts/benchmark.sh [--no-transcribe]
#
#   --no-transcribe   Reuse cached transcripts; skip the Gradium STT pass.
#                     Use this when iterating on metrics without burning
#                     API quota.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VOICE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$VOICE_DIR/../.." && pwd)"

cd "$REPO_ROOT"

if [ ! -d "$VOICE_DIR/.venv" ]; then
  echo "error: $VOICE_DIR/.venv not found. Create it with:"
  echo "  python3 -m venv $VOICE_DIR/.venv && source $VOICE_DIR/.venv/bin/activate && pip install -r $VOICE_DIR/requirements.txt"
  exit 1
fi

# shellcheck disable=SC1090
source "$VOICE_DIR/.venv/bin/activate"

TRANSCRIBE="--transcribe"
for arg in "$@"; do
  case "$arg" in
    --no-transcribe) TRANSCRIBE="" ;;
    *) ;;
  esac
done

echo "▶ dataset eval ($([ -n "$TRANSCRIBE" ] && echo 'with' || echo 'without') Gradium pass)…"
if [ -n "$TRANSCRIBE" ]; then
  python -m apps.voice.src.evaluate_audio_dataset --transcribe
else
  python -m apps.voice.src.evaluate_audio_dataset
fi

echo
echo "▶ intelligence eval (SAIS)…"
python -m apps.voice.src.evaluate_audio_intelligence

echo
echo "▶ outputs:"
echo "  $VOICE_DIR/submission/audio_dataset_transcripts.json"
echo "  $VOICE_DIR/submission/audio_dataset_results.json"
echo "  $VOICE_DIR/submission/audio_intelligence_results.json"
