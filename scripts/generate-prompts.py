"""Generate English audio with Microsoft Edge TTS; never uploads textbook files.

- Word prompts: apps/web/public/audio/<word>.mp3 (adult British voice, slow).
- Monkey guide lines: apps/web/public/audio/guide/<key>.mp3, one per entry of
  apps/web/src/data/guide.json (child British voice). A line may carry "say" when the
  spoken part differs from the on-screen text (e.g. the word is played separately).
  LISTEN is text-only.

Existing files are kept; delete a file to regenerate it. Set HTTPS_PROXY if needed.
"""
import asyncio
import json
import os
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'apps/web/public/audio'
GUIDE = ROOT / 'apps/web/src/data/guide.json'
WORDS = ['apple', 'banana', 'grapes', 'orange', 'watermelon', 'pear']
WORD_VOICE = ('en-GB-SoniaNeural', {'rate': '-10%'})
GUIDE_VOICE = ('en-GB-MaisieNeural', {'rate': '-5%', 'pitch': '+8Hz'})
TEXT_ONLY = {'LISTEN'}
PROXY = os.environ.get('HTTPS_PROXY') or os.environ.get('HTTP_PROXY')


async def speak(text: str, target: Path, voice):
    name, options = voice
    if target.exists():
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    await edge_tts.Communicate(text, name, proxy=PROXY, **options).save(str(target))
    print(f'{target.relative_to(AUDIO)}: {target.stat().st_size} bytes')


async def main():
    for word in WORDS:
        await speak(word, AUDIO / f'{word}.mp3', WORD_VOICE)
    lines = json.loads(GUIDE.read_text(encoding='utf-8'))
    for key, line in lines.items():
        if key in TEXT_ONLY:
            continue
        await speak(line.get('say', line['text']), AUDIO / 'guide' / f'{key.lower()}.mp3', GUIDE_VOICE)


if __name__ == '__main__':
    asyncio.run(main())
