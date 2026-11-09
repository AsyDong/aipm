"""Compose listening cards that show a count of one food (Unit 3 counting node).

Builds square cards from existing transparent webp assets: three apples, six
bananas and so on, arranged like dice pips on a soft rounded card. Usage:
python scripts/make-count-cards.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / 'apps/web/public/images/count'
IMAGES = Path(__file__).resolve().parents[1] / 'apps/web/public/images'
CARD = 560
# Dice-pip layouts keep small counts readable at a glance.
LAYOUTS = {
    2: [(0.30, 0.50), (0.70, 0.50)],
    3: [(0.28, 0.28), (0.72, 0.28), (0.50, 0.70)],
    4: [(0.30, 0.30), (0.70, 0.30), (0.30, 0.70), (0.70, 0.70)],
    5: [(0.28, 0.26), (0.72, 0.26), (0.50, 0.50), (0.28, 0.74), (0.72, 0.74)],
    6: [(0.30, 0.25), (0.70, 0.25), (0.30, 0.50), (0.70, 0.50), (0.30, 0.75), (0.70, 0.75)],
}
CARDS = {
    'apples-3': ('fruit/apple.webp', 3),
    'bananas-6': ('fruit/banana.webp', 6),
    'oranges-2': ('fruit/orange.webp', 2),
    'burgers-4': ('food/burger.webp', 4),
    'eggs-5': ('food/egg.webp', 5),
}


def card(source: Path, count: int) -> Image.Image:
    base = Image.new('RGBA', (CARD, CARD), (0, 0, 0, 0))
    drawn = ImageDraw.Draw(base)
    drawn.rounded_rectangle((10, 10, CARD - 10, CARD - 10), 48, fill=(255, 249, 231, 255), outline=(232, 196, 106, 255), width=8)
    item = Image.open(source).convert('RGBA')
    size = round(300 / max(1, count**0.5)) + 90  # more items -> smaller copies
    item.thumbnail((size, size), Image.LANCZOS)
    for fx, fy in LAYOUTS[count]:
        xy = (round(fx * CARD) - item.width // 2, round(fy * CARD) - item.height // 2)
        base.alpha_composite(item, xy)
    return base


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (source, count) in CARDS.items():
        card(IMAGES / source, count).save(OUT / f'{name}.webp', quality=88, method=6)
        print(f'count/{name}.webp', (OUT / f'{name}.webp').stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
