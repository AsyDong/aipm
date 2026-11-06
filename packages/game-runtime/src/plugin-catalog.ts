import type { PluginRegistration } from '@english/contracts';
import {
  TapMechanic,
  VoiceMatchMechanic,
  SliceMechanic,
} from '@english/game-mechanics';
import { FruitWorldScene } from '@english/game-scenes';
import type Phaser from 'phaser';
import { composerPlugins } from './composer';

/**
 * The local plugin list. A game picks its scene and mechanic by id in its
 * GameDefinition; adding Voice Match or Slice means adding one entry here.
 */
export function pluginCatalog(scene: Phaser.Scene): PluginRegistration[] {
  const factories: Record<string, PluginRegistration['create']> = {
    'fruit-world': () => new FruitWorldScene(scene),
    tap: () => new TapMechanic(),
    'voice-match': () => new VoiceMatchMechanic(),
    slice: () => new SliceMechanic(),
  };
  return composerPlugins.map((plugin) => {
    const create = factories[plugin.metadata.id];
    if (!create)
      throw new Error(`Missing local factory: ${plugin.metadata.id}`);
    return { ...plugin, create };
  });
}
