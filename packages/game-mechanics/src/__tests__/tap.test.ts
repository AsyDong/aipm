import { expect, it, vi } from 'vitest';
import { EventBus } from '../../../game-core/src/events';
import { TapMechanic, tapMetadata } from '../tap';
import type {
  GameContext,
  InputEvent,
  LearningContent,
  LearningTask,
  SceneItem,
  SceneObject,
} from '@english/contracts';

const content = (id: string): LearningContent => ({
  id,
  text: id,
  curriculumId: 'c',
  unitId: 'u',
  assets: { image: `/${id}.svg`, audio: `/${id}.mp3` },
  source: { kind: 'DEMO', reference: 'test' },
});
const [x, y] = [content('x'), content('y')] as [
  LearningContent,
  LearningContent,
];
const task: LearningTask = {
  id: 't',
  curriculumId: 'c',
  unitId: 'u',
  target: x,
  candidates: [x, y],
};

function setup() {
  const bus = new EventBus('g', 's');
  let handler: (e: InputEvent) => void = () => {};
  const unsubscribe = vi.fn();
  const shown: SceneItem[][] = [];
  const hit: { value?: SceneObject } = {};
  const context = {
    eventBus: bus,
    state: { lifecycle: 'RUNNING' },
    tasks: { current: () => task },
    input: {
      subscribe: (h: (e: InputEvent) => void) => {
        handler = h;
        return unsubscribe;
      },
    },
    objects: {
      show: (items: SceneItem[]) => shown.push(items),
      hitTest: () => hit.value,
    },
  } as unknown as GameContext;
  const tap = new TapMechanic();
  tap.initialize(context);
  tap.start();
  const selected = vi.fn();
  bus.on('OBJECT_SELECTED', selected);
  return {
    bus,
    tap,
    handler: (e: InputEvent) => handler(e),
    unsubscribe,
    shown,
    hit,
    selected,
  };
}
const tapAt: InputEvent = {
  type: 'TAP',
  source: 'MOUSE',
  x: 1,
  y: 1,
  timestamp: 1,
};

it('shows candidates without revealing the answer, and reports a selection without judging it', () => {
  const t = setup();
  t.bus.emit('TASK_PRESENTED', {
    taskId: 't',
    contentId: 'x',
    curriculumId: 'c',
    unitId: 'u',
  });
  expect(t.shown[0]).toEqual([
    { objectId: 't:0', contentId: 'x', image: '/x.svg' },
    { objectId: 't:1', contentId: 'y', image: '/y.svg' },
  ]);
  t.hit.value = {
    objectId: 't:1',
    contentId: 'y',
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  };
  t.handler(tapAt);
  expect(t.selected).toHaveBeenCalledTimes(1);
  expect(t.selected.mock.calls[0]?.[0].payload).toEqual({
    objectId: 't:1',
    contentId: 'y',
    taskId: 't',
  });
});

it('ignores taps that miss, swipes, and input while paused; unsubscribes on destroy', () => {
  const t = setup();
  t.handler(tapAt); // nothing under the pointer
  t.hit.value = {
    objectId: 't:0',
    contentId: 'x',
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  };
  t.handler({
    type: 'SWIPE',
    source: 'MOUSE',
    points: [{ x: 0, y: 0, timestamp: 1 }],
    timestamp: 1,
  });
  t.tap.pause();
  t.handler(tapAt);
  expect(t.selected).not.toHaveBeenCalled();
  t.tap.resume();
  t.handler(tapAt);
  expect(t.selected).toHaveBeenCalledTimes(1);
  t.tap.destroy();
  expect(t.unsubscribe).toHaveBeenCalledTimes(1);
  t.bus.emit('TASK_PRESENTED', {
    taskId: 't',
    contentId: 'x',
    curriculumId: 'c',
    unitId: 'u',
  });
  expect(t.shown).toHaveLength(0); // listener removed with the plugin
});

it('declares the capabilities and config schema the engine validates', () => {
  expect(tapMetadata.requiredCapabilities).toEqual(['OBJECTS', 'HIT_TEST']);
  expect(tapMetadata.configSchema).toMatchObject({
    additionalProperties: false,
  });
});
