import { afterEach, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: {} }));
import type {
  GameContext,
  GameDefinition,
  SceneItem,
} from '@english/contracts';
import {
  GameEngine,
  PluginManager,
  RuleEngine,
  RewardManager,
  TaskRunner,
} from '@english/game-core';
import { FruitWorldScene } from '../../game-scenes/src/fruit-world';
import { fruitWorldMetadata } from '../../game-scenes/src/metadata';
import { reactionFixture } from '../../game-mechanics/src/__tests__/reaction/fixture';
import { InputManager } from './input';
import { createTasks, parseContents } from '@english/learning-core';
import contents from '../../../apps/web/src/data/contents.json';
import original from '../../../apps/web/src/data/powerup0-listen-find.json';
import type Phaser from 'phaser';

afterEach(() => vi.useRealTimers());
it('runs a new delayed-response plugin with the existing FruitWorld and round loop across restarts', async () => {
  vi.useFakeTimers();
  const background = {
    setDisplaySize: vi.fn().mockReturnThis(),
    setDepth: vi.fn().mockReturnThis(),
    destroy: vi.fn(),
  };
  const scene = {
    add: { image: () => background },
    scene: { pause: vi.fn(), resume: vi.fn() },
  };
  const manager = new PluginManager();
  manager.register({
    metadata: fruitWorldMetadata,
    create: () => new FruitWorldScene(scene as unknown as Phaser.Scene),
  });
  manager.register(reactionFixture);
  const definition: GameDefinition = {
    ...(original as GameDefinition),
    mechanic: {
      id: 'reaction-test',
      version: '1.0.0',
      config: { delayMs: 100 },
    },
  };
  expect(
    manager.validate({
      ...definition,
      mechanic: { ...definition.mechanic, config: { delayMs: -1 } },
    }).valid,
  ).toBe(false);
  const input = new InputManager();
  const shown = vi.fn<(items: SceneItem[]) => void>();
  const shelf = vi.fn();
  const rules = new RuleEngine();
  const rewards = new RewardManager();
  let runner: TaskRunner;
  let current: SceneItem[] = [];
  shown.mockImplementation((items) => {
    current = items;
  });
  const submit = vi.fn((id: string) => runner.submit(id));
  const engine = new GameEngine(manager, (base) => {
    runner = new TaskRunner(
      base.eventBus,
      rules,
      rewards,
      definition,
      base.sessionId,
    );
    return {
      context: {
        ...base,
        input,
        tasks: runner,
        rules,
        rewards,
        objects: {
          setShelf: shelf,
          show: shown,
          hitTest: () =>
            current.find(
              (item) => item.contentId === runner.current()?.target.id,
            ),
          clear: vi.fn(),
        },
        answers: { isOpen: () => base.state.lifecycle === 'RUNNING', submit },
      } as unknown as GameContext,
      dispose: () => input.disable(),
    };
  });
  await engine.initialize(definition);
  await engine.start();
  const tasks = createTasks(
    parseContents(contents).filter((item) => item.curriculumId === 'powerup-0'),
    1,
    3,
  );
  const tap = () =>
    input.dispatch({
      type: 'TAP',
      source: 'MOUSE',
      x: 0,
      y: 0,
      timestamp: Date.now(),
    });
  for (let i = 0; i < 5; i++) {
    if (i) await engine.restart();
    runner!.start(tasks);
    input.enable(['MOUSE']);
    tap();
    expect(submit).toHaveBeenCalledTimes(i);
    await vi.advanceTimersByTimeAsync(100);
    engine.pause();
    tap();
    expect(submit).toHaveBeenCalledTimes(i);
    engine.resume();
    tap();
    expect(submit).toHaveBeenCalledTimes(i + 1);
    expect(rewards.getSummary().stars).toBe(1);
  }
  expect(shelf).toHaveBeenCalledWith(770, 565);
  await engine.destroy();
  input.enable(['MOUSE']);
  tap();
  expect(submit).toHaveBeenCalledTimes(5);
  expect(background.destroy).toHaveBeenCalledTimes(5);
});
