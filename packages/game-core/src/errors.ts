import type { GameError } from '@english/contracts';

/**
 * Typed failure (task book 11.4). code examples: CONFIG_INVALID, PLUGIN_ERROR,
 * ASSET_LOAD_FAILED, INPUT_ERROR, SPEECH_ERROR, RUNTIME_ERROR.
 */
export class GameFailure extends Error implements GameError {
  constructor(
    readonly code: string,
    readonly module: string,
    message: string,
    readonly recoverable = false,
    cause?: unknown,
  ) {
    super(message, { cause });
    this.name = 'GameFailure';
  }
}
