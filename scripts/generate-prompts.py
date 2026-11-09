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
# Multi-word prompts (filename, spoken text) that do not come from WORDS.
PHRASES = [
    ('hello-cameron', 'Hello! I am Cameron.'),
    ('hello-jim', 'Hello! I am Jim.'),
    ('hello-jenny', 'Hello! I am Jenny.'),
    ('the-red-bus', 'The red bus!'),
    ('the-blue-bus', 'The blue bus!'),
    ('the-green-bus', 'The green bus!'),
    ('the-yellow-bus', 'The yellow bus!'),
    ('the-boat', 'The boat! All aboard!'),
    ('rice', 'rice'),
    ('beans', 'beans'),
    ('egg', 'egg'),
    ('burger', 'burger'),
    ('carrot', 'carrot'),
    ('three-apples', 'Three apples!'),
    ('six-bananas', 'Six bananas!'),
    ('two-oranges', 'Two oranges!'),
    ('four-burgers', 'Four burgers!'),
    ('five-eggs', 'Five eggs!'),
]
# Per-level welcome lines for the sample world (spoken as the guide, one file each).
LEVEL_HELLO = {
    'harbour-friends': 'Hello! Welcome to the harbour! Can you find the friend who says hello?',
    'find-the-bus': 'Great! Now listen and find the bus I say.',
    'all-aboard': 'Well done! Now find what I say, and then we sail!',
    'fruit-stall': 'The fruit stall is empty! Put the fruit I say on the shelf.',
    'grocery-shop': "Now let's shop for the picnic. Find the food I say.",
    'counting-boxes': 'The boxes are mixed up! Listen and find the right box.',
    'fruit-kitchen': "Let's make a fruit plate! Slice the fruit I say.",
    'picnic-time': 'Picnic time! Bring the food I say to the table.',
}
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
    for filename, text in PHRASES:
        await speak(text, AUDIO / f'{filename}.mp3', WORD_VOICE)
    lines = json.loads(GUIDE.read_text(encoding='utf-8'))
    for key, line in lines.items():
        if key in TEXT_ONLY:
            continue
        await speak(line.get('say', line['text']), AUDIO / 'guide' / f'{key.lower()}.mp3', GUIDE_VOICE)
    for level, text in LEVEL_HELLO.items():
        await speak(text, AUDIO / 'guide' / f'hello-{level}.mp3', GUIDE_VOICE)


if __name__ == '__main__':
    asyncio.run(main())
