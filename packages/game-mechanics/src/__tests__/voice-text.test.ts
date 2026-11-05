import { expect, it } from 'vitest';
import { normalizeVoiceText } from '../voice-text';

it.each([
  ['  HELLO!\n', 'hello'],
  ['“Hello.”', 'hello'],
  ['ＨＥＬＬＯ！', 'hello'],
  ['\thello\u00a0 \n world? ', 'hello world'],
  ['hello\u200bworld', 'hello world'],
  ['hel.lo', 'hel lo'],
  ['hello-world', 'hello world'],
  ['!!!', ''],
  ['[BLANK_AUDIO]', ''],
  ['[no_speech]', ''],
  ['[noise]', ''],
  ['<unk>', ''],
  ['(silence)', ''],
  ['no  speech', ''],
  ['null', ''],
  ['undefined', ''],
])('normalizes %j to %j without joining words', (raw, expected) => {
  expect(normalizeVoiceText(raw)).toBe(expected);
});
