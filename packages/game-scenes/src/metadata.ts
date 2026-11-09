import type { AssetReference, PluginMetadata } from '@english/contracts';

/** Kept apart from the Phaser code so composers and tests can read it without a browser. */
export const fruitWorldMetadata: PluginMetadata = {
  id: 'fruit-world',
  name: 'Fruit World',
  version: '1.0.0',
  apiVersion: '1.0.0',
  type: 'SCENE',
  requiredCapabilities: [],
  capabilities: ['OBJECTS', 'ANIMATION', 'HIT_TEST', 'SLICE'],
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: { theme: { enum: ['MARKET', 'FOREST', 'HARBOUR'] } },
  },
};

export const fruitWorldBackground = (config: Record<string, unknown>) =>
  config.theme === 'FOREST'
    ? '/images/scenes/forest.webp'
    : config.theme === 'HARBOUR'
      ? '/images/scenes/harbour.webp'
      : '/images/scenes/market.webp';

/** Where the counter top is in each backdrop, in world units (1280x720). */
export const fruitWorldShelf = (config: Record<string, unknown>) =>
  config.theme === 'FOREST'
    ? { centerX: 640, baseY: 525 }
    : config.theme === 'HARBOUR'
      ? { centerX: 640, baseY: 645 } // the wooden pier
      : { centerX: 770, baseY: 565 };

export const fruitWorldAssets = (
  config: Record<string, unknown>,
): AssetReference[] => {
  const url = fruitWorldBackground(config);
  return [{ key: url, type: 'IMAGE', url, version: '1.0.0' }];
};
