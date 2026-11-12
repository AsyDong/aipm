import { expect, it, vi } from 'vitest';
import type {
  GameContext,
  InputEvent,
  LearningContent,
  LearningTask,
  SceneObject,
} from '@english/contracts';
import { EventBus } from '../../../game-core/src/events';
import {
  CountPackMechanic,
  boxSlot,
  validateCountPackConfig,
} from '../count-pack';

const numeral = (n: number): LearningContent =>
  ({
    id: `numeral-${n}`,
    curriculumId: 'c',
    unitId: 'u',
    text: `${n}`,
    assets: { image: `/numeral-${n}.webp`, audio: '/how_many.mp3' },
    illustration: `/group-${n}.webp`,
  }) as LearningContent;
const counted = (food: string, n: number): LearningContent =>
  ({
    id: `count-${food}-${n}`,
    curriculumId: 'c',
    unitId: 'u',
    text: `${n} ${food}`,
    assets: { image: `/${food}-${n}.webp`, audio: `/${food}-${n}.mp3` },
    illustration: `/${food}.webp`,
    quantity: n,
  }) as LearningContent;

function taskOf(
  target: LearningContent,
  pool: LearningContent[],
): LearningTask {
  return {
    id: `task:${target.id}`,
    curriculumId: 'c',
    unitId: 'u',
    target,
    candidates: pool.filter((item) => item.id !== target.id).slice(0, 3),
  } as LearningTask;
}

function harness(target: LearningContent, pool: LearningContent[]) {
  const bus = new EventBus('g', 's');
  const task = taskOf(target, pool);
  const show = vi.fn(),
    collect = vi.fn(),
    clearCollected = vi.fn(),
    setShelf = vi.fn(),
    submit = vi.fn();
  const instances: SceneObject[] = Array.from({ length: 6 }, (_, i) => ({
    objectId: `${task.id}:pack-${i}`,
    contentId: target.id,
    x: 100 + i * 100,
    y: 500,
    width: 40,
    height: 40,
  }));
  const candidates: SceneObject[] = task.candidates.map((candidate, i) => ({
    objectId: `${task.id}:${i}`,
    contentId: candidate.id,
    x: 700 + i * 100,
    y: 500,
    width: 40,
    height: 40,
  }));
  let handle: (input: InputEvent) => void = () => {};
  const context = {
    eventBus: bus,
    state: { lifecycle: 'RUNNING' },
    definition: { content: { curriculumId: 'c', unitId: 'u', items: [] } },
    tasks: { current: () => task },
    content: { resolve: async () => pool },
    answers: { isOpen: () => true, submit },
    input: {
      subscribe: (fn: typeof handle) => {
        handle = fn;
        return vi.fn();
      },
    },
    objects: {
      show,
      collect,
      clearCollected,
      setShelf,
      hitTest: (x: number, y: number) =>
        [...instances, ...candidates].find(
          (object) =>
            Math.abs(object.x - x) <= 20 && Math.abs(object.y - y) <= 20,
        ),
    },
  } as unknown as GameContext;
  const tap = (x: number, y = 500) =>
    handle({ type: 'TAP', source: 'TOUCH', x, y, timestamp: 1 });
  const present = () =>
    bus.emit('TASK_PRESENTED', {
      taskId: task.id,
      contentId: target.id,
      curriculumId: 'c',
      unitId: 'u',
    });
  return {
    bus,
    context,
    show,
    collect,
    clearCollected,
    submit,
    tap,
    present,
    instances,
  };
}

it('validates config and computes box slots in two rows inside the box', () => {
  expect(validateCountPackConfig({})).toEqual({
    x: 1000,
    y: 540,
    width: 260,
    height: 220,
  });
  const box = { x: 500, y: 400, width: 200, height: 200 };
  expect(validateCountPackConfig({ box })).toEqual(box);
  for (const config of [
    { extra: true },
    { box: { x: 0 } },
    { box: { ...box, width: 0 } },
  ])
    expect(() => validateCountPackConfig(config)).toThrow('CountPackConfig');
  expect(boxSlot(box, 0)).toEqual({ x: 430, y: 365, scale: 0.48 });
  expect(boxSlot(box, 3).y).toBe(435);
});

it('COUNT: shows a large inert question plus numerals; taps on numerals submit', async () => {
  const pool = [numeral(3), numeral(2), numeral(4), numeral(5)];
  const { context, show, submit, tap, present } = harness(pool[0]!, pool);
  const mechanic = new CountPackMechanic();
  await mechanic.initialize(context, {});
  mechanic.start();
  present();
  const items = show.mock.calls[0]![0];
  expect(items[0]).toMatchObject({ size: 'LARGE', image: '/group-3.webp' });
  expect(items.slice(1)).toHaveLength(3);
  // The question picture is for counting, never an answer.
  tap(50, 40); // not on anything
  expect(submit).not.toHaveBeenCalled();
  const question = items[0]!;
  const originalHitTest = context.objects.hitTest.bind(context.objects);
  context.objects.hitTest = ((x: number, y: number) =>
    x === 999
      ? { objectId: question.objectId, contentId: question.contentId }
      : originalHitTest(x, y)) as never;
  tap(999);
  expect(submit).not.toHaveBeenCalled();
  tap(700); // first numeral candidate
  expect(submit).toHaveBeenCalledTimes(1);
  expect(submit.mock.calls[0]![0]).toBe('numeral-2');
  mechanic.destroy();
});

it('PACK: packs single foods into the box, judges the quantity on box tap, resets after a miss', async () => {
  const pool = [
    counted('apples', 3),
    counted('oranges', 2),
    counted('eggs', 5),
  ];
  const {
    bus,
    context,
    show,
    collect,
    clearCollected,
    submit,
    tap,
    present,
    instances,
  } = harness(pool[0]!, pool);
  const mechanic = new CountPackMechanic();
  await mechanic.initialize(context, {});
  mechanic.start();
  present();
  const items = show.mock.calls[0]![0];
  expect(clearCollected).toHaveBeenCalledTimes(1);
  expect(items).toHaveLength(6);
  expect(items.every((item: { size?: string }) => item.size === 'SMALL')).toBe(
    true,
  );
  // Pack two apples: no answer yet, each tap collects one mini.
  tap(instances[0]!.x);
  tap(instances[1]!.x);
  expect(collect).toHaveBeenCalledTimes(2);
  expect(submit).not.toHaveBeenCalled();
  // The same apple cannot be packed twice.
  tap(instances[0]!.x);
  expect(collect).toHaveBeenCalledTimes(2);
  tap(1000, 540); // the box says "two"
  expect(submit).toHaveBeenCalledWith('count-oranges-2');
  // A wrong quantity empties the box; the counter offers the food again.
  bus.emit(
    'ANSWER_INCORRECT',
    { taskId: 't', contentId: 'x', attempts: 1 },
    'rules',
  );
  tap(instances[0]!.x);
  expect(collect).toHaveBeenCalledTimes(3);
  tap(instances[1]!.x);
  tap(instances[2]!.x);
  tap(1000, 540);
  expect(submit).toHaveBeenLastCalledWith('count-apples-3');
  mechanic.destroy();
});

it('PACK: a quantity no item names is not judged; packing caps at six', async () => {
  const pool = [counted('apples', 3), counted('oranges', 2)];
  const { context, collect, submit, tap, present, instances } = harness(
    pool[0]!,
    pool,
  );
  const mechanic = new CountPackMechanic();
  await mechanic.initialize(context, {});
  mechanic.start();
  present();
  tap(instances[0]!.x);
  tap(1000, 540); // one item: no content names "one", keep packing
  expect(submit).not.toHaveBeenCalled();
  for (const instance of instances.slice(1)) tap(instance.x);
  expect(collect).toHaveBeenCalledTimes(6);
  tap(instances[0]!.x); // already full
  expect(collect).toHaveBeenCalledTimes(6);
  mechanic.destroy();
});

it('requires an illustration on every pool item', async () => {
  const target = counted('apples', 3);
  const noIllustration = numeral(2);
  delete noIllustration.illustration;
  const pool = [target, noIllustration];
  const { context } = harness(target, pool);
  await expect(new CountPackMechanic().initialize(context, {})).rejects.toThrow(
    'illustration',
  );
});
