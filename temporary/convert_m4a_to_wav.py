#!/usr/bin/env python3
"""Convert .m4a audio files to .wav using ffmpeg or macOS afconvert."""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert one .m4a file or a directory of .m4a files to .wav."
    )
    parser.add_argument(
        "input",
        type=Path,
        help="Path to an .m4a file or a directory containing .m4a files.",
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help=(
            "Output .wav file for a single input, or output directory for a directory "
            "input. Defaults to writing next to the source files."
        ),
    )
    parser.add_argument(
        "-r",
        "--recursive",
        action="store_true",
        help="Recursively convert .m4a files when the input is a directory.",
    )
    parser.add_argument(
        "--sample-rate",
        type=int,
        default=16000,
        help="Output sample rate in Hz. Default: 16000.",
    )
    parser.add_argument(
        "--channels",
        type=int,
        default=1,
        help="Output channel count. Default: 1.",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite existing .wav files.",
    )
    return parser.parse_args()


def find_inputs(input_path: Path, recursive: bool) -> list[Path]:
    if input_path.is_file():
        if input_path.suffix.lower() != ".m4a":
            raise ValueError(f"Input file is not an .m4a file: {input_path}")
        return [input_path]

    if input_path.is_dir():
        pattern = "**/*.m4a" if recursive else "*.m4a"
        return sorted(path for path in input_path.glob(pattern) if path.is_file())

    raise FileNotFoundError(f"Input path does not exist: {input_path}")


def output_path_for(source: Path, input_root: Path, output: Path | None) -> Path:
    if source.is_file() and input_root.is_file():
        if output is None:
            return source.with_suffix(".wav")
        if output.suffix.lower() == ".wav":
            return output
        return output / source.with_suffix(".wav").name

    if output is None:
        return source.with_suffix(".wav")

    relative = source.relative_to(input_root)
    return (output / relative).with_suffix(".wav")


def convert_file(
    source: Path,
    destination: Path,
    sample_rate: int,
    channels: int,
    overwrite: bool,
) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)

    if destination.exists() and not overwrite:
        print(f"skip exists: {destination}")
        return

    ffmpeg = shutil.which("ffmpeg")
    afconvert = shutil.which("afconvert")

    if ffmpeg:
        command = [
            ffmpeg,
            "-hide_banner",
            "-loglevel",
            "error",
            "-y" if overwrite else "-n",
            "-i",
            str(source),
            "-ac",
            str(channels),
            "-ar",
            str(sample_rate),
            "-c:a",
            "pcm_s16le",
            str(destination),
        ]
    elif afconvert:
        if destination.exists() and overwrite:
            destination.unlink()
        command = [
            afconvert,
            str(source),
            str(destination),
            "-f",
            "WAVE",
            "-d",
            f"LEI16@{sample_rate}",
            "-c",
            str(channels),
        ]
    else:
        raise RuntimeError("ffmpeg or macOS afconvert is required.")

    subprocess.run(command, check=True)
    print(f"converted: {source} -> {destination}")


def main() -> int:
    args = parse_args()

    if shutil.which("ffmpeg") is None and shutil.which("afconvert") is None:
        print(
            "ffmpeg or macOS afconvert is required. Install ffmpeg with: brew install ffmpeg",
            file=sys.stderr,
        )
        return 1

    input_path = args.input.expanduser().resolve()
    output = args.output.expanduser().resolve() if args.output else None

    try:
        sources = find_inputs(input_path, args.recursive)
    except (FileNotFoundError, ValueError) as exc:
        print(exc, file=sys.stderr)
        return 1

    if not sources:
        print(f"No .m4a files found in: {input_path}", file=sys.stderr)
        return 1

    for source in sources:
        destination = output_path_for(source, input_path, output)
        convert_file(
            source=source,
            destination=destination,
            sample_rate=args.sample_rate,
            channels=args.channels,
            overwrite=args.overwrite,
        )

    print(f"Done. Converted {len(sources)} file(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
