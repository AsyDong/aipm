"""Generate a short synthetic swoosh; no recording or external service is used."""
import math
from pathlib import Path
import random
import struct
import subprocess

randomizer = random.Random(5)
rate = 24000
samples = bytearray()
for i in range(int(rate * 0.16)):
    t = i / rate
    envelope = math.sin(math.pi * t / 0.16) ** 2
    value = envelope * (0.3 * randomizer.uniform(-1, 1) + 0.1 * math.sin(2 * math.pi * (1600 * t - 3500 * t * t)))
    samples.extend(struct.pack('<h', int(value * 32767)))
target = Path(__file__).resolve().parents[1] / 'apps/web/public/audio/effects/slice.mp3'
target.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 's16le', '-ar', str(rate), '-ac', '1', '-i', 'pipe:0', '-codec:a', 'libmp3lame', '-b:a', '64k', str(target)], input=bytes(samples), check=True)
print('Generated synthetic slice effect')
