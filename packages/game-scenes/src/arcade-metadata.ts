import type { AssetReference, PluginMetadata } from '@english/contracts';
import { fruitWorldBackground } from './metadata';

export const arcadeWorldMetadata: PluginMetadata = {
  id: 'arcade-world',
  name: 'Learning Arcade',
  version: '1.0.0',
  apiVersion: '1.0.0',
  type: 'SCENE',
  requiredCapabilities: [],
  capabilities: ['OBJECTS', 'ARCADE', 'ANIMATION', 'HIT_TEST'],
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: { theme: { enum: ['MARKET', 'FOREST', 'HARBOUR'] } },
  },
};

export const arcadeWorldAssets = (
  config: Record<string, unknown>,
): AssetReference[] =>
  [fruitWorldBackground(config), '/images/mascot.webp'].map((url) => ({
    key: url,
    type: 'IMAGE' as const,
    url,
    version: '1.0.0',
  }));
