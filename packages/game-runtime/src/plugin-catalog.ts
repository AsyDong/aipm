import type { PluginRegistration } from '@english/contracts';
import {
  TapMechanic,
  tapMetadata,
  VoiceMatchMechanic,
  voiceMatchMetadata,
} from '@english/game-mechanics';
import {
  FruitWorldScene,
  fruitWorldAssets,
  fruitWorldMetadata,
} from '@english/game-scenes';
import type Phaser from 'phaser';

/**
 * The local plugin list. A game picks its scene and mechanic by id in its
 * GameDefinition; adding Voice Match or Slice means adding one entry here.
 */
export function pluginCatalog(scene: Phaser.Scene): PluginRegistration[] {
  return [
    {
      metadata: fruitWorldMetadata,
      create: () => new FruitWorldScene(scene),
      assets: fruitWorldAssets,
    },
    { metadata: tapMetadata, create: () => new TapMechanic() },
    { metadata: voiceMatchMetadata, create: () => new VoiceMatchMechanic() },
  ];
}
