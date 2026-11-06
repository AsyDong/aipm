import { useState } from 'react';
import type { GameDefinition } from '@english/contracts';
import {
  composerPlugins,
  validateComposition,
  checkCompositionAssets,
} from '@english/runtime';
import { allContent, definitionFor } from './content';

const KEY = 'english-adventure:composition';

export function Composer({
  onPreview,
  onExit,
}: {
  onPreview: (game: GameDefinition) => void;
  onExit: () => void;
}) {
  const [game, setGame] = useState<GameDefinition>(() => ({
    ...structuredClone(definitionFor('powerup0-listen-find')),
    id: 'my-level',
    name: 'My listening game',
  }));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [json, setJson] = useState('');
  const curricula = [...new Set(allContent.map((item) => item.curriculumId))];
  const units = [
    ...new Set(
      allContent
        .filter((item) => item.curriculumId === game.content.curriculumId)
        .map((item) => item.unitId),
    ),
  ];
  const items = allContent.filter(
    (item) =>
      item.curriculumId === game.content.curriculumId &&
      item.unitId === game.content.unitId,
  );
  const change = (next: GameDefinition) => {
    setGame(next);
    setMessage('');
  };
  const selectUnit = (curriculumId: string, unitId: string) =>
    change({
      ...game,
      content: {
        curriculumId,
        unitId,
        items: allContent
          .filter(
            (item) =>
              item.curriculumId === curriculumId && item.unitId === unitId,
          )
          .map((item) => ({ contentId: item.id })),
      },
    });
  const run = async (
    action: 'validate' | 'save' | 'preview' | 'export' | 'import' | 'load',
  ) => {
    setBusy(true);
    setMessage('Checking configuration and assets…');
    try {
      let raw: unknown = game;
      if (action === 'import') raw = JSON.parse(json);
      if (action === 'load') {
        const saved = localStorage.getItem(KEY);
        if (!saved) throw new Error('No saved level on this device');
        raw = JSON.parse(saved);
      }
      const checked = await validateComposition(raw, allContent);
      await checkCompositionAssets(checked, allContent);
      if (action === 'save') localStorage.setItem(KEY, JSON.stringify(checked));
      if (action === 'import' || action === 'load') setGame(checked);
      if (action === 'export') {
        const url = URL.createObjectURL(
          new Blob([JSON.stringify(checked, null, 2)], {
            type: 'application/json',
          }),
        );
        const link = document.createElement('a');
        link.href = url;
        link.download = 'game-definition.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      setMessage(
        action === 'save'
          ? 'Level saved on this device.'
          : 'Configuration and assets are valid.',
      );
      if (action === 'preview') onPreview(checked);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to check this level',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="composer" aria-label="Game Composer">
      <h1>Game Composer</h1>
      <p>
        For grown-ups. Create a local level from existing plugins and content.
        Preview does not save learning notes or stars.
      </p>
      <button onClick={onExit} disabled={busy}>
        Back to the map
      </button>
      <fieldset disabled={busy}>
        <legend>Level</legend>
        <label>
          Level ID
          <input
            value={game.id}
            onChange={(e) => change({ ...game, id: e.target.value })}
          />
        </label>
        <label>
          Title
          <input
            value={game.name}
            onChange={(e) => change({ ...game, name: e.target.value })}
          />
        </label>
        <label>
          Scene
          <select
            value={game.scene.id}
            onChange={(e) =>
              change({
                ...game,
                scene: { id: e.target.value, version: '1.0.0', config: {} },
              })
            }
          >
            {composerPlugins
              .filter((plugin) => plugin.metadata.type === 'SCENE')
              .map(({ metadata }) => (
                <option key={metadata.id} value={metadata.id}>
                  {metadata.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Theme
          <select
            value={String(game.scene.config.theme ?? 'MARKET')}
            onChange={(e) =>
              change({
                ...game,
                scene: { ...game.scene, config: { theme: e.target.value } },
              })
            }
          >
            <option value="MARKET">Market</option>
            <option value="FOREST">Forest</option>
          </select>
        </label>
        <label>
          Mechanic
          <select
            value={game.mechanic.id}
            onChange={(e) =>
              change({
                ...game,
                mechanic: { id: e.target.value, version: '1.0.0', config: {} },
                input: {
                  allowed:
                    e.target.value === 'voice-match'
                      ? ['VOICE']
                      : ['MOUSE', 'TOUCH'],
                },
              })
            }
          >
            {composerPlugins
              .filter((plugin) => plugin.metadata.type === 'MECHANIC')
              .map(({ metadata }) => (
                <option key={metadata.id} value={metadata.id}>
                  {metadata.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Input
          <select
            value={game.input.allowed.join(',')}
            onChange={(e) =>
              change({
                ...game,
                input: {
                  allowed: e.target.value.split(
                    ',',
                  ) as GameDefinition['input']['allowed'],
                },
              })
            }
          >
            <option value="MOUSE,TOUCH">Mouse and touch</option>
            <option value="MOUSE">Mouse</option>
            <option value="TOUCH">Touch</option>
            <option value="VOICE">Voice</option>
          </select>
        </label>
        {game.mechanic.id === 'slice' && (
          <label>
            Minimum swipe distance
            <input
              type="number"
              min="12"
              max="100"
              value={Number(game.mechanic.config.minDistance ?? 32)}
              onChange={(e) =>
                change({
                  ...game,
                  mechanic: {
                    ...game.mechanic,
                    config: { minDistance: Number(e.target.value) },
                  },
                })
              }
            />
          </label>
        )}
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Learning content</legend>
        <label>
          Curriculum
          <select
            value={game.content.curriculumId}
            onChange={(e) =>
              selectUnit(
                e.target.value,
                allContent.find((item) => item.curriculumId === e.target.value)!
                  .unitId,
              )
            }
          >
            {curricula.map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </label>
        <label>
          Unit
          <select
            value={game.content.unitId}
            onChange={(e) =>
              selectUnit(game.content.curriculumId, e.target.value)
            }
          >
            {units.map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </label>
        {items.map((item) => (
          <label key={item.id}>
            <input
              type="checkbox"
              checked={game.content.items.some(
                (reference) => reference.contentId === item.id,
              )}
              onChange={(e) =>
                change({
                  ...game,
                  content: {
                    ...game.content,
                    items: e.target.checked
                      ? [...game.content.items, { contentId: item.id }]
                      : game.content.items.filter(
                          (reference) => reference.contentId !== item.id,
                        ),
                  },
                })
              }
            />
            {item.text}
          </label>
        ))}
      </fieldset>
      <fieldset disabled={busy}>
        <legend>Rules and star rewards</legend>
        <label>
          Rounds
          <input
            type="number"
            min="1"
            max="100"
            value={game.rules.rounds ?? 5}
            onChange={(e) =>
              change({
                ...game,
                rules: { ...game.rules, rounds: Number(e.target.value) },
              })
            }
          />
        </label>
        <label>
          Choices
          <input
            type="number"
            min="2"
            max="6"
            value={game.difficulty?.optionCount ?? 3}
            onChange={(e) =>
              change({
                ...game,
                difficulty: { optionCount: Number(e.target.value) },
              })
            }
          />
        </label>
        <label>
          Order
          <select
            value={game.rules.progression?.mode ?? 'RANDOM'}
            onChange={(e) =>
              change({
                ...game,
                rules: {
                  ...game.rules,
                  progression: {
                    mode: e.target.value as 'RANDOM' | 'SEQUENTIAL',
                  },
                },
              })
            }
          >
            <option>RANDOM</option>
            <option>SEQUENTIAL</option>
          </select>
        </label>
        <label>
          Hints
          <input
            type="checkbox"
            checked={game.rules.hintPolicy?.enabled ?? false}
            onChange={(e) =>
              change({
                ...game,
                rules: {
                  ...game.rules,
                  hintPolicy: {
                    enabled: e.target.checked,
                    afterAttempts: 0,
                    hintLevel: 1,
                  },
                },
              })
            }
          />
        </label>
        <label>
          Stars per correct answer
          <input
            type="number"
            min="0"
            max="100"
            value={game.reward.successReward}
            onChange={(e) =>
              change({
                ...game,
                reward: {
                  ...game.reward,
                  successReward: Number(e.target.value),
                },
              })
            }
          />
        </label>
        <label>
          Completion bonus
          <input
            type="number"
            min="0"
            max="100"
            value={game.reward.completionBonus ?? 0}
            onChange={(e) =>
              change({
                ...game,
                reward: {
                  ...game.reward,
                  completionBonus: Number(e.target.value),
                },
              })
            }
          />
        </label>
        <p>
          Unlimited retries; no time limit. Voice preview requires the speech
          backend.
        </p>
      </fieldset>
      <div className="composer-actions">
        {(['validate', 'save', 'load', 'preview', 'export'] as const).map(
          (action) => (
            <button
              key={action}
              disabled={busy}
              onClick={() => {
                void run(action);
              }}
            >
              {
                {
                  validate: 'Validate',
                  save: 'Save level',
                  load: 'Load saved level',
                  preview: 'Preview',
                  export: 'Download JSON',
                }[action]
              }
            </button>
          ),
        )}
      </div>
      <p role="status">{message}</p>
      <details>
        <summary>Standard GameDefinition JSON</summary>
        <pre>{JSON.stringify(game, null, 2)}</pre>
        <label>
          Import JSON
          <textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            disabled={busy}
          />
        </label>
        <button
          disabled={busy}
          onClick={() => {
            void run('import');
          }}
        >
          Import configuration
        </button>
      </details>
    </section>
  );
}
