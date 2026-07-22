"""Normalize generated JINMON phase art for the in-game full-screen overlay."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


TARGET_SIZE = (1600, 900)
MAX_BYTES = 500 * 1024


def center_crop_to_ratio(image: Image.Image, target_ratio: float) -> Image.Image:
    width, height = image.size
    current_ratio = width / height
    if abs(current_ratio - target_ratio) < 0.001:
        return image
    if current_ratio > target_ratio:
        crop_width = round(height * target_ratio)
        left = (width - crop_width) // 2
        return image.crop((left, 0, left + crop_width, height))
    crop_height = round(width / target_ratio)
    top = (height - crop_height) // 2
    return image.crop((0, top, width, top + crop_height))


def save_under_budget(image: Image.Image, output: Path) -> tuple[int, int]:
    output.parent.mkdir(parents=True, exist_ok=True)
    for quality in range(84, 59, -3):
        image.save(output, "WEBP", quality=quality, method=6)
        size = output.stat().st_size
        if size <= MAX_BYTES:
            return quality, size
    raise RuntimeError(f"Could not compress {output} below {MAX_BYTES} bytes")


def parse_source(value: str) -> tuple[str, Path]:
    try:
        name, raw_path = value.split("=", 1)
    except ValueError as error:
        raise argparse.ArgumentTypeError("source must be NAME=PATH") from error
    return name, Path(raw_path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", action="append", type=parse_source, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()

    target_ratio = TARGET_SIZE[0] / TARGET_SIZE[1]
    for name, source in args.source:
        with Image.open(source) as opened:
            normalized = center_crop_to_ratio(opened.convert("RGB"), target_ratio)
            normalized = normalized.resize(TARGET_SIZE, Image.Resampling.LANCZOS)
        output = args.output_dir / f"phase-{name}.webp"
        quality, size = save_under_budget(normalized, output)
        print(f"{output}: {TARGET_SIZE[0]}x{TARGET_SIZE[1]}, q={quality}, {size} bytes")


if __name__ == "__main__":
    main()
