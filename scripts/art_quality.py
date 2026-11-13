"""Size-bounded WebP output for vocabulary artwork."""
from pathlib import Path

from PIL import Image

MAX_WORD_BYTES = 10_000


def save_word_webp(image: Image.Image, path: Path, max_side: int = 320) -> None:
    """Keep the highest quality that fits 10 KB; shrink only when necessary."""
    side = min(max(image.size), max_side)
    while side >= 160:
        scale = side / max(image.size)
        resized = image.resize(
            (max(1, round(image.width * scale)), max(1, round(image.height * scale))),
            Image.Resampling.LANCZOS,
        )
        for quality in (82, 74, 66, 58, 50, 42, 34, 26, 18):
            resized.save(
                path,
                'WEBP',
                quality=quality,
                method=6,
                alpha_quality=70,
            )
            if path.stat().st_size <= MAX_WORD_BYTES:
                return
        side -= 32
    raise ValueError(f'Cannot fit {path.name} within {MAX_WORD_BYTES} bytes')
