"""Turn raw Seedream output into transparent game assets: key out the flat
background colour, crop, and save small webp files. The three courseware
portraits are maintained separately and keep their approved white backing.
Usage: python scripts/process-art.py <raw-dir>"""
import sys
from pathlib import Path
from PIL import Image
import numpy as np

from art_quality import save_word_webp

RAW = Path(sys.argv[1])
OUT = Path(__file__).resolve().parents[1] / 'apps/web/public/images'

def key_out(path: Path, box: int) -> Image.Image:
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    border = np.concatenate([rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3), rgb[:, :8].reshape(-1, 3), rgb[:, -8:].reshape(-1, 3)])
    key = np.median(border, axis=0)
    dist = np.linalg.norm(rgb - key, axis=2)
    alpha = np.clip((dist - 70) / 70, 0, 1)  # soft edge between 70 and 140
    a = alpha[..., None]
    # remove the key colour that bleeds into semi-transparent edge pixels
    fg = np.where(a > 0.02, (rgb - (1 - a) * key) / np.maximum(a, 0.02), rgb)
    rgba = np.dstack([np.clip(fg, 0, 255), alpha * 255]).astype(np.uint8)
    img = Image.fromarray(rgba, 'RGBA')
    img = img.crop(img.getchannel('A').point(lambda v: 255 if v > 10 else 0).getbbox())
    scale = box / max(img.size)
    img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
    # Keep the scene hidden outside the sprite; pale details remain opaque.
    square = Image.new('RGBA', (box + 16, box + 16), (0, 0, 0, 0))
    square.alpha_composite(img, ((square.width - img.width) // 2, (square.height - img.height) // 2))
    return square

(OUT / 'fruit').mkdir(parents=True, exist_ok=True)
(OUT / 'scenes').mkdir(parents=True, exist_ok=True)
(OUT / 'characters').mkdir(parents=True, exist_ok=True)
(OUT / 'vehicles').mkdir(parents=True, exist_ok=True)
(OUT / 'food').mkdir(parents=True, exist_ok=True)

def process(src: str, run) -> None:
    """Raw output stays external; skip sources that are not in the current raw set."""
    if not (RAW / f'{src}.png').exists():
        print('skip (no raw):', src)
        return
    run()

for name in ['apple', 'banana', 'grapes', 'orange', 'watermelon', 'pear']:
    process(f'fruit_{name}', lambda n=name: save_word_webp(key_out(RAW / f'fruit_{n}.png', 380), OUT / 'fruit' / f'{n}.webp'))
process('mascot', lambda: key_out(RAW / 'mascot.png', 480).save(OUT / 'mascot.webp', quality=88, method=6))
for src, dst in [('market', 'scenes/market'), ('forest', 'scenes/forest'), ('scene_harbour', 'scenes/harbour'), ('map', 'map')]:
    process(src, lambda s=src, d=dst: Image.open(RAW / f'{s}.png').convert('RGB').save(OUT / f'{d}.webp', quality=80, method=6))
# Original courseware portraits are maintained separately; generated vehicles and food.
for src, dst in [
    ('bus_red', 'vehicles/bus-red'),
    ('bus_blue', 'vehicles/bus-blue'),
    ('bus_green', 'vehicles/bus-green'),
    ('bus_yellow', 'vehicles/bus-yellow'),
    ('boat', 'vehicles/boat'),
    ('food_rice', 'food/rice'),
    ('food_beans', 'food/beans'),
    ('food_egg', 'food/egg'),
    ('food_burger', 'food/burger'),
    ('food_carrot', 'food/carrot'),
]:
    process(src, lambda s=src, d=dst: save_word_webp(key_out(RAW / f'{s}.png', 380), OUT / f'{d}.webp'))
for f in sorted(OUT.rglob('*.webp')):
    print(f.relative_to(OUT), f.stat().st_size // 1024, 'KB')
