"""Generate isolated English prompts with Microsoft Edge TTS; never uploads textbook files."""
import asyncio
from pathlib import Path
import edge_tts

WORDS = ['apple', 'banana', 'grapes', 'orange', 'watermelon', 'pear']
OUTPUT = Path(__file__).resolve().parents[1] / 'apps/web/public/audio'

async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for word in WORDS:
        target = OUTPUT / f'{word}.mp3'
        if not target.exists():
            await edge_tts.Communicate(word, 'en-GB-SoniaNeural', rate='-10%').save(str(target))
        print(f'{word}: {target.stat().st_size} bytes')
    for key, text in [('welcome', 'Listen. Find the fruit. Tap to choose.'), ('again', 'Listen again. You can do it.'), ('success', 'Great listening!'), ('complete', 'Adventure complete. Shall we play again?')]:
        target = OUTPUT / f'{key}.mp3'
        if not target.exists():
            await edge_tts.Communicate(text, 'en-GB-SoniaNeural', rate='-10%').save(str(target))

if __name__ == '__main__':
    asyncio.run(main())
