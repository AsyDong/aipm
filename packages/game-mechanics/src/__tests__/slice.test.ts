import { expect, it, vi } from 'vitest';
import type {
  GameContext,
  InputEvent,
  LearningTask,
  SceneObject,
} from '@english/contracts';
import { EventBus } from '../../../game-core/src/events';
import { PluginManager } from '../../../game-core/src/plugins';
import { fruitWorldMetadata } from '../../../game-scenes/src/metadata';
import { definitionFor } from '../../../../apps/web/src/content';
import {
  SliceMechanic,
  firstSwipeHit,
  segmentHit,
  sliceMetadata,
  validateSliceConfig,
} from '../slice';

const object = (id: string, x: number): SceneObject => ({
  objectId: id,
  contentId: id,
  x,
  y: 50,
  width: 20,
  height: 20,
});
const points = (xs: number[]) => xs.map((x) => ({ x, y: 50, timestamp: 1 }));
it('intersects complete segments, includes edges and chooses path order rather than candidate order', () => {
  const a = object('a', 50),
    b = object('b', 100);
  expect(segmentHit({ x: 0, y: 40 }, { x: 200, y: 40 }, a)).toBe(0.2);
  expect(segmentHit({ x: 0, y: 39 }, { x: 200, y: 39 }, a)).toBeUndefined();
  expect(segmentHit({ x: 50, y: 50 }, { x: 50, y: 50 }, a)).toBe(0);
  expect(segmentHit({ x: 50, y: 0 }, { x: 50, y: 100 }, a)).toBe(0.4);
  expect(firstSwipeHit(points([0, 200]), [b, a])).toBe(a);
  expect(firstSwipeHit(points([200, 0]), [a, b])).toBe(b);
  expect(firstSwipeHit(points([0, 30, 120]), [b, a])).toBe(a);
});

it('validates SliceConfig using both the registry schema and direct guard; Fruit World supports Tap and Slice', () => {
  expect(validateSliceConfig({})).toEqual({ minDistance: 32 });
  for (const config of [
    { minDistance: NaN },
    { minDistance: 1 },
    { minDistance: 101 },
    { extra: true },
  ])
    expect(() => validateSliceConfig(config)).toThrow('SliceConfig');
  const manager = new PluginManager();
  const plugin = {
    initialize() {},
    start() {},
    pause() {},
    resume() {},
    destroy() {},
  };
  manager.register({ metadata: fruitWorldMetadata, create: () => plugin });
  manager.register({
    metadata: sliceMetadata,
    create: () => new SliceMechanic(),
  });
  const definition = {
    ...definitionFor('powerup0-listen-find'),
    mechanic: { id: 'slice', version: '1.0.0', config: {} },
  };
  expect(manager.validate(definition).valid).toBe(true);
  expect(
    manager.validate({
      ...definition,
      mechanic: { ...definition.mechanic, config: { minDistance: 1 } },
    }).valid,
  ).toBe(false);
});

it('reports one cut per object/task, permits another choice, rejects locked or paused input and resets on new task', () => {
  const bus = new EventBus('g', 's');
  const a = object('a', 50),
    b = object('b', 100);
  const task = {
    id: 't',
    candidates: ['a', 'b'].map((id) => ({
      id,
      assets: { image: `/${id}.webp` },
    })),
  } as LearningTask;
  let handle: (input: InputEvent) => void = () => {};
  let open = true;
  const submit = vi.fn(),
    slice = vi.fn(),
    show = vi.fn();
  const context = {
    eventBus: bus,
    state: { lifecycle: 'RUNNING' },
    tasks: { current: () => task },
    answers: { isOpen: () => open, submit },
    input: {
      subscribe: (fn: typeof handle) => {
        handle = fn;
        return vi.fn();
      },
    },
    objects: {
      show,
      slice,
      findByContent: (id: string) => (id === 'a' ? a : b),
    },
  } as unknown as GameContext;
  const mechanic = new SliceMechanic();
  mechanic.initialize(context, {});
  mechanic.start();
  const present = () =>
    bus.emit('TASK_PRESENTED', {
      taskId: 't',
      contentId: 'a',
      curriculumId: 'c',
      unitId: 'u',
    });
  present();
  expect(show).toHaveBeenCalledTimes(1);
  const swipe = (xs: number[]) =>
    handle({
      type: 'SWIPE',
      source: 'TOUCH',
      points: points(xs),
      timestamp: 1,
    });
  open = false;
  swipe([0, 200]);
  open = true;
  swipe([45, 50]); // too short
  mechanic.pause();
  swipe([0, 200]);
  mechanic.resume();
  expect(submit).not.toHaveBeenCalled();
  swipe([0, 200]);
  expect(submit).toHaveBeenLastCalledWith('a', 'a');
  expect(submit).toHaveBeenCalledTimes(1);
  swipe([0, 200]);
  expect(submit).toHaveBeenLastCalledWith('b', 'b');
  swipe([0, 200]);
  expect(submit).toHaveBeenCalledTimes(2);
  expect(slice).toHaveBeenCalledTimes(2);
  present();
  swipe([0, 200]);
  expect(submit).toHaveBeenCalledTimes(3);
  mechanic.destroy();
  swipe([0, 200]);
  expect(submit).toHaveBeenCalledTimes(3);
});
