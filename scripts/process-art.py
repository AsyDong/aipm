"""Turn raw Seedream output into game assets: key out the flat background colour,
crop, and save small webp files. Usage: python scripts/process-art.py <raw-dir>"""
import sys
from pathlib import Path
from PIL import Image
import numpy as np

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
    square = Image.new('RGBA', (box + 16, box + 16), (0, 0, 0, 0))
    square.paste(img, ((square.width - img.width) // 2, (square.height - img.height) // 2))
    return square

(OUT / 'fruit').mkdir(parents=True, exist_ok=True)
(OUT / 'scenes').mkdir(parents=True, exist_ok=True)
for name in ['apple', 'banana', 'grapes', 'orange', 'watermelon', 'pear']:
    key_out(RAW / f'fruit_{name}.png', 380).save(OUT / 'fruit' / f'{name}.webp', quality=88, method=6)
key_out(RAW / 'mascot.png', 480).save(OUT / 'mascot.webp', quality=88, method=6)
for src, dst in [('market', 'scenes/market'), ('forest', 'scenes/forest'), ('map', 'map')]:
    Image.open(RAW / f'{src}.png').convert('RGB').save(OUT / f'{dst}.webp', quality=80, method=6)
for f in sorted(OUT.rglob('*.webp')):
    print(f.relative_to(OUT), f.stat().st_size // 1024, 'KB')
