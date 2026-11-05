import type { PluginMetadata } from '@english/contracts';

/** Kept apart from the Phaser code so composers and tests can read it without a browser. */
export const fruitWorldMetadata: PluginMetadata = {
  id: 'fruit-world',
  name: 'Fruit World',
  version: '1.0.0',
  apiVersion: '1.0.0',
  type: 'SCENE',
  requiredCapabilities: [],
  capabilities: ['OBJECTS', 'ANIMATION', 'HIT_TEST'],
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: { theme: { enum: ['ORCHARD', 'FOREST'] } },
  },
};
