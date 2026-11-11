import type {
  GameDefinition,
  LearningContent,
  PluginMetadata,
  AssetReference,
} from '@english/contracts';
import { PluginManager } from '@english/game-core';
import { ContentResolver } from '@english/learning-core';
import {
  tapMetadata,
  voiceMatchMetadata,
  sliceMetadata,
  sliceAssets,
  countPackMetadata,
} from '@english/game-mechanics';
import {
  fruitWorldMetadata,
  fruitWorldAssets,
} from '../../game-scenes/src/metadata';
import { validateAdventure } from './validate-adventure';
import { AssetManager, loadBrowserAsset } from './assets';

/** Shared local descriptors: no Phaser objects or executable configuration. */
export const composerPlugins: {
  metadata: PluginMetadata;
  assets?: (config: Record<string, unknown>) => AssetReference[];
}[] = [
  { metadata: fruitWorldMetadata, assets: fruitWorldAssets },
  { metadata: tapMetadata },
  { metadata: voiceMatchMetadata },
  { metadata: sliceMetadata, assets: sliceAssets },
  { metadata: countPackMetadata },
];

export async function validateComposition(
  raw: unknown,
  contents: LearningContent[],
): Promise<GameDefinition> {
  const manager = new PluginManager();
  for (const plugin of composerPlugins)
    manager.register({
      ...plugin,
      create: () => {
        throw new Error('Validation does not instantiate plugins');
      },
    });
  const validation = manager.validate(raw);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  const definition = raw as GameDefinition;
  validateAdventure(definition);
  const resolved = await new ContentResolver(contents).resolve(
    definition.content,
  );
  if (resolved.length < 2) throw new Error('Select at least two content items');
  if ((definition.difficulty?.optionCount ?? 3) > resolved.length)
    throw new Error('Option count exceeds selected content');
  return structuredClone(definition);
}

/** Same loader and scoped ownership as gameplay; deduplicates URLs before loading. */
export async function checkCompositionAssets(
  definition: GameDefinition,
  contents: LearningContent[],
) {
  const resolved = await new ContentResolver(contents).resolve(
    definition.content,
  );
  const references: AssetReference[] = resolved.flatMap((item) => [
    ...(item.distractors ?? []).map((choice) => ({
      key: choice.assets.image,
      url: choice.assets.image,
      type: 'IMAGE' as const,
      version: '1.0.0',
    })),
    ...(item.illustration
      ? [
          {
            key: item.illustration,
            url: item.illustration,
            type: 'IMAGE' as const,
            version: '1.0.0',
          },
        ]
      : []),
    {
      key: item.assets.image,
      url: item.assets.image,
      type: 'IMAGE',
      version: '1.0.0',
    },
    {
      key: item.assets.audio,
      url: item.assets.audio,
      type: 'AUDIO',
      version: '1.0.0',
    },
  ]);
  for (const spec of [definition.scene, definition.mechanic])
    references.push(
      ...(composerPlugins
        .find((plugin) => plugin.metadata.id === spec.id)
        ?.assets?.(spec.config) ?? []),
    );
  const assets = new AssetManager(loadBrowserAsset);
  try {
    await assets.preload({
      scope: 'composer',
      assets: [
        ...new Map(references.map((asset) => [asset.key, asset])).values(),
      ],
    });
  } finally {
    await assets.destroy();
  }
}
