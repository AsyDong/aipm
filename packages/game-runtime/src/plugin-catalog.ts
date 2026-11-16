import type { PluginRegistration } from '@english/contracts';
import {
  TapMechanic,
  VoiceMatchMechanic,
  SliceMechanic,
  CountPackMechanic,
  FruitCatchMechanic,
  ArcadeMechanic,
} from '@english/game-mechanics';
import {
  ArcadeWorldScene,
  FruitCatchScene,
  FruitWorldScene,
} from '@english/game-scenes';
import type Phaser from 'phaser';
import { composerPlugins } from './composer';

/**
 * The local plugin list. A game picks its scene and mechanic by id in its
 * GameDefinition; adding Voice Match or Slice means adding one entry here.
 */
export function pluginCatalog(scene: Phaser.Scene): PluginRegistration[] {
  const factories: Record<string, PluginRegistration['create']> = {
    'fruit-world': () => new FruitWorldScene(scene),
    'catch-world': () => new FruitCatchScene(scene),
    'arcade-world': () => new ArcadeWorldScene(scene),
    tap: () => new TapMechanic(),
    'voice-match': () => new VoiceMatchMechanic(),
    slice: () => new SliceMechanic(),
    'count-pack': () => new CountPackMechanic(),
    'fruit-catch': () => new FruitCatchMechanic(),
    arcade: () => new ArcadeMechanic(),
  };
  return composerPlugins.map((plugin) => {
    const create = factories[plugin.metadata.id];
    if (!create)
      throw new Error(`Missing local factory: ${plugin.metadata.id}`);
    return { ...plugin, create };
  });
}
