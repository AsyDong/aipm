"""Size-bounded WebP output for vocabulary artwork."""
from pathlib import Path

from PIL import Image, ImageDraw

MAX_WORD_BYTES = 10_000


def opaque_word_card(image: Image.Image) -> Image.Image:
    """Give pale vocabulary a fully opaque, contrasting card (no alpha channel)."""
    source = image.convert('RGBA')
    side = max(source.size)
    margin = round(side * 0.08)
    card = Image.new('RGBA', (side, side), '#fff1c9')
    draw = ImageDraw.Draw(card)
    draw.rounded_rectangle(
        (3, 3, side - 4, side - 4),
        radius=round(side * 0.11),
        fill='#fff8e7',
        outline='#d99b3d',
        width=max(3, side // 80),
    )
    draw.ellipse(
        (margin, margin, side - margin, side - margin),
        fill='#c8e5eb',
        outline='#6ba4ad',
        width=max(2, side // 120),
    )
    source.thumbnail((side - margin * 2, side - margin * 2), Image.Resampling.LANCZOS)
    card.alpha_composite(source, ((side - source.width) // 2, (side - source.height) // 2))
    return card.convert('RGB')


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
