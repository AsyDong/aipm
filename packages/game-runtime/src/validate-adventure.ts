import type { GameDefinition } from '@english/contracts';

/** Contracts reserve later features; this runtime rejects options it cannot execute yet. */
export function validateAdventure(definition: GameDefinition) {
  if (
    !definition.rules.allowRetry ||
    definition.rules.maxAttempts !== undefined ||
    definition.rules.timeLimitMs != null
  )
    throw new Error(
      'This adventure requires unlimited retries without a time limit',
    );
  if (definition.reward.type !== 'STAR')
    throw new Error('This adventure supports star rewards only');
  const voice = definition.mechanic.id === 'voice-match';
  if (
    definition.input.allowed.some((source) =>
      voice ? source !== 'VOICE' : source !== 'TOUCH' && source !== 'MOUSE',
    ) ||
    (voice && !definition.input.allowed.includes('VOICE')) ||
    definition.input.settings
  )
    throw new Error(
      'This adventure requires matching mechanic input without device settings',
    );
  if ((definition.rules.hintPolicy?.hintLevel ?? 1) !== 1)
    throw new Error('This adventure supports hint level 1 only');
}
