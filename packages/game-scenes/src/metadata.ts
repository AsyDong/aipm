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
    properties: {
      theme: { enum: ['MARKET', 'FOREST', 'HARBOUR'] },
      place: {
        enum: ['BASKET', 'SHELF', 'PLATE', 'CHARACTERS', 'BOX'],
      },
      box: {
        type: 'object',
        additionalProperties: false,
        required: ['x', 'y', 'width', 'height'],
        properties: {
          x: { type: 'number' },
          y: { type: 'number' },
          width: { type: 'number' },
          height: { type: 'number' },
        },
      },
    },
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

export type PlaceKind = 'BASKET' | 'SHELF' | 'PLATE' | 'CHARACTERS' | 'BOX';

export interface PlaceProp {
  image: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface PlaceCharacter {
  image: string;
  x: number;
  y: number;
  height: number;
}
export interface PlaceLayout {
  kind: PlaceKind;
  prop?: PlaceProp;
  characters?: PlaceCharacter[];
  /** Where solved items land, in order; the last one repeats when full. */
  slots: { x: number; y: number; scale: number }[];
}

/** The visible destination for solved items, per stop on Market Street. */
export const PLACE_LAYOUTS: Record<PlaceKind, PlaceLayout> = {
  BASKET: {
    kind: 'BASKET',
    prop: {
      image: '/images/props/basket.webp',
      x: 250,
      y: 565,
      width: 330,
      height: 240,
    },
    slots: [
      { x: 185, y: 522, scale: 0.45 },
      { x: 250, y: 512, scale: 0.45 },
      { x: 315, y: 522, scale: 0.45 },
      { x: 215, y: 582, scale: 0.45 },
      { x: 285, y: 582, scale: 0.45 },
    ],
  },
  SHELF: {
    kind: 'SHELF',
    prop: {
      image: '/images/props/shelf.webp',
      x: 205,
      y: 480,
      width: 300,
      height: 400,
    },
    slots: [
      { x: 140, y: 400, scale: 0.5 },
      { x: 205, y: 392, scale: 0.5 },
      { x: 270, y: 400, scale: 0.5 },
      { x: 170, y: 538, scale: 0.5 },
      { x: 240, y: 538, scale: 0.5 },
    ],
  },
  PLATE: {
    kind: 'PLATE',
    prop: {
      image: '/images/props/plate.webp',
      x: 250,
      y: 560,
      width: 350,
      height: 240,
    },
    slots: [
      { x: 190, y: 528, scale: 0.4 },
      { x: 250, y: 518, scale: 0.4 },
      { x: 310, y: 528, scale: 0.4 },
      { x: 215, y: 585, scale: 0.4 },
      { x: 285, y: 585, scale: 0.4 },
      { x: 250, y: 552, scale: 0.4 },
    ],
  },
  CHARACTERS: {
    kind: 'CHARACTERS',
    characters: [
      { image: '/images/characters/cameron.webp', x: 75, y: 380, height: 150 },
      { image: '/images/characters/jim.webp', x: 190, y: 380, height: 150 },
      { image: '/images/characters/jenny.webp', x: 300, y: 395, height: 135 },
    ],
    // Two visible deliveries per friend, in Cameron/Jim/Jenny round order.
    slots: [
      { x: 55, y: 485, scale: 0.36 },
      { x: 175, y: 485, scale: 0.36 },
      { x: 285, y: 485, scale: 0.36 },
      { x: 95, y: 570, scale: 0.36 },
      { x: 215, y: 570, scale: 0.36 },
      { x: 305, y: 585, scale: 0.36 },
    ],
  },
  BOX: {
    kind: 'BOX',
    // The rect itself comes from config.box so the mechanic shares the tap zone.
    slots: [],
  },
};

export const fruitWorldPlace = (
  config: Record<string, unknown>,
): PlaceLayout | undefined =>
  config.place ? PLACE_LAYOUTS[config.place as PlaceKind] : undefined;

export const fruitWorldAssets = (
  config: Record<string, unknown>,
): AssetReference[] => {
  const images = [fruitWorldBackground(config)];
  const place = fruitWorldPlace(config);
  if (place?.prop) images.push(place.prop.image);
  for (const character of place?.characters ?? []) images.push(character.image);
  if (place?.kind === 'BOX') images.push('/images/props/box.webp');
  return images.map((url) => ({
    key: url,
    type: 'IMAGE' as const,
    url,
    version: '1.0.0',
  }));
};
