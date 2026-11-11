"""Draw the Market Street collection props (Unit 3 stops).

Basket for the entrance/grocery, shelf for the stall, plate for the kitchen,
crate for the packing station. Flat storybook shapes, transparent background,
matching the generated fruit art. Usage: python scripts/make-scene-props.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / 'apps/web/public/images/props'
WOOD = (176, 122, 63, 255)
WOOD_DARK = (138, 90, 44, 255)
WOOD_LIGHT = (224, 170, 99, 255)


def basket() -> Image.Image:
    base = Image.new('RGBA', (660, 480), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    # body: a wide trapezoid with a rounded bottom
    d.polygon([(60, 130), (600, 130), (540, 420), (120, 420)], fill=WOOD)
    d.rounded_rectangle((110, 380, 550, 440), 28, fill=WOOD)
    # weave: horizontal bands and uprights
    for y in (190, 250, 310, 370):
        left = 60 + (y - 130) * 60 // 290
        right = 600 - (y - 130) * 60 // 290
        d.line((left + 4, y, right - 4, y), fill=WOOD_DARK, width=10)
    for x in range(130, 560, 70):
        d.line((x, 140, x - 14, 420), fill=WOOD_DARK, width=8)
    # rim and handle
    d.rounded_rectangle((40, 100, 620, 160), 30, fill=WOOD_LIGHT, outline=WOOD_DARK, width=8)
    d.arc((180, 0, 480, 220), 180, 360, fill=WOOD_DARK, width=26)
    return base


def shelf() -> Image.Image:
    base = Image.new('RGBA', (600, 800), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    for x in (56, 508):
        d.rounded_rectangle((x, 60, x + 36, 780), 12, fill=WOOD_DARK)
    for y in (330, 610):
        d.rounded_rectangle((20, y, 580, y + 36), 12, fill=WOOD, outline=WOOD_DARK, width=6)
        d.line((30, y + 8, 570, y + 8), fill=WOOD_LIGHT, width=6)
    d.rounded_rectangle((20, 40, 580, 76), 12, fill=WOOD, outline=WOOD_DARK, width=6)
    return base


def plate() -> Image.Image:
    base = Image.new('RGBA', (700, 480), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    d.ellipse((20, 60, 680, 450), fill=(127, 182, 217, 255))
    d.ellipse((40, 75, 660, 435), fill=(253, 252, 246, 255))
    d.ellipse((110, 125, 590, 390), outline=(222, 228, 232, 255), width=10)
    return base


def box() -> Image.Image:
    base = Image.new('RGBA', (520, 440), (0, 0, 0, 0))
    d = ImageDraw.Draw(base)
    # dark open top, then the front face with planks and a cross brace
    d.polygon([(40, 150), (120, 60), (480, 60), (400, 150)], fill=(92, 58, 28, 255))
    d.polygon([(400, 150), (480, 60), (480, 320), (400, 420)], fill=WOOD_DARK)
    d.rectangle((40, 150, 400, 420), fill=WOOD)
    for y in (215, 285, 355):
        d.line((40, y, 400, y), fill=WOOD_DARK, width=8)
    d.line((60, 160, 380, 410), fill=WOOD_LIGHT, width=22)
    d.line((380, 160, 60, 410), fill=WOOD_LIGHT, width=22)
    d.rectangle((40, 150, 400, 420), outline=WOOD_DARK, width=10)
    d.polygon([(30, 140), (110, 50), (490, 50), (410, 140)], outline=WOOD_DARK, width=10)
    return base


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, draw in [('basket', basket), ('shelf', shelf), ('plate', plate), ('box', box)]:
        target = OUT / f'{name}.webp'
        draw().save(target, quality=88, method=6)
        print(f'props/{name}.webp', target.stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
