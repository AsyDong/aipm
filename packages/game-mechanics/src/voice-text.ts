/** Provider-neutral single-word normalization; never guesses spelling or inflection. */
export function normalizeVoiceText(text: string): string {
  const normalized = text.normalize('NFKC').toLowerCase().trim();
  if (
    /^(?:\[(?:blank_audio|no_speech|silence|noise|inaudible)\]|<(?:unk|unknown|silence)>|\((?:silence|noise|inaudible)\)|no\s+(?:speech|audio)|null|undefined)$/u.test(
      normalized,
    )
  )
    return '';
  // Replace separators with spaces: "hel.lo" must never turn into "hello".
  return normalized
    .replace(/[\p{P}\p{S}\p{C}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}
