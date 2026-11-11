"""Compose listening cards that show a count of one food (Unit 3 counting node).

Builds count alternatives using single-item food assets (never banana bunches).
Each question shows the same food in different quantities. Usage:
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
    f'{food}-{count}': (source, count)
    for food, source in [('apples', 'fruit/apple.webp'), ('oranges', 'fruit/orange.webp'),
                         ('burgers', 'food/burger.webp'), ('eggs', 'food/egg.webp')]
    for count in range(2, 7)
}


def card(source: Path, count: int) -> Image.Image:
    base = Image.new('RGBA', (CARD, CARD), (0, 0, 0, 0))
    drawn = ImageDraw.Draw(base)
    drawn.rounded_rectangle((10, 10, CARD - 10, CARD - 10), 48, fill=(255, 249, 231, 255), outline=(232, 196, 106, 255), width=8)
    item = Image.open(source).convert('RGBA')
    size = 160 if count >= 5 else 210  # keep neighbouring items separate for counting
    item.thumbnail((size, size), Image.LANCZOS)
    for fx, fy in LAYOUTS[count]:
        xy = (round(fx * CARD) - item.width // 2, round(fy * CARD) - item.height // 2)
        base.alpha_composite(item, xy)
    return base


def main() -> None:
    assert all(len(LAYOUTS[count]) == count for count in range(2, 7))
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (source, count) in CARDS.items():
        card(IMAGES / source, count).save(OUT / f'{name}.webp', quality=88, method=6)
        print(f'count/{name}.webp', (OUT / f'{name}.webp').stat().st_size // 1024, 'KB')
    for count in range(2, 7):
        numeral(count).save(OUT / f'numeral-{count}.webp', quality=88, method=6)
        print(f'count/numeral-{count}.webp written')


def numeral(count: int) -> Image.Image:
    """Answer cards for How-many: a big digit with counting pips underneath."""
    from PIL import ImageFont

    base = Image.new('RGBA', (CARD, CARD), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    d.rounded_rectangle((10, 10, CARD - 10, CARD - 10), 48, fill=(255, 249, 231, 255), outline=(232, 196, 106, 255), width=8)
    font = None
    for name in ('C:/Windows/Fonts/arialbd.ttf', 'C:/Windows/Fonts/arial.ttf'):
        try:
            font = ImageFont.truetype(name, 300)
            break
        except OSError:
            continue
    d.text((CARD / 2, 300), str(count), fill=(138, 90, 44, 255), font=font, anchor='mm')
    radius = 24
    gap = 70
    start = CARD / 2 - (count - 1) * gap / 2
    for i in range(count):
        x = start + i * gap
        d.ellipse((x - radius, 470 - radius, x + radius, 470 + radius), fill=(232, 156, 60, 255))
    return base


if __name__ == '__main__':
    main()
