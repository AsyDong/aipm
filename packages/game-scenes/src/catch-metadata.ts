import type {
  AssetReference,
  CatchTheme,
  PluginMetadata,
} from '@english/contracts';

export const fruitCatchMetadata: PluginMetadata = {
  id: 'catch-world',
  name: 'Monkey’s Fruit Catch',
  version: '1.0.0',
  apiVersion: '1.0.0',
  type: 'SCENE',
  requiredCapabilities: [],
  capabilities: ['OBJECTS', 'ANIMATION', 'CATCH'],
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {},
  },
};

export const fruitCatchTheme: CatchTheme = {
  body: '/images/monkey/body.webp',
  legLeft: '/images/monkey/leg-left.webp',
  legRight: '/images/monkey/leg-right.webp',
  basket: '/images/props/basket.webp',
};

export const fruitCatchAssets = (): AssetReference[] =>
  ['/images/scenes/market.webp', ...Object.values(fruitCatchTheme)].map(
    (url) => ({ key: url, type: 'IMAGE' as const, url, version: '1.0.0' }),
  );
