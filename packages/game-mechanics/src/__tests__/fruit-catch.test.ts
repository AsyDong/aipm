import { expect, it, vi } from 'vitest';
import { EventBus } from '../../../game-core/src/events';
import type {
  GameContext,
  InputEvent,
  LearningCandidate,
  LearningContent,
  LearningTask,
  SceneObject,
} from '@english/contracts';
import { FruitCatchMechanic } from '../fruit-catch';

const content = (id: string): LearningContent => ({
  id,
  curriculumId: 'c',
  unitId: 'u',
  text: id,
  assets: { image: `/${id}.webp`, audio: `/${id}.mp3` },
  source: { reference: 'test', kind: 'DEMO' },
});
const candidate = (item: LearningContent): LearningCandidate => ({
  id: item.id,
  curriculumId: item.curriculumId,
  unitId: item.unitId,
  text: item.text,
  assets: { image: item.assets.image },
});

function setup() {
  const target = content('apple');
  const other = content('banana');
  const task: LearningTask = {
    id: 'task',
    curriculumId: 'c',
    unitId: 'u',
    target,
    candidates: [candidate(target), candidate(other)],
  };
  const eventBus = new EventBus('game', 'session');
  let inputHandler: ((event: InputEvent) => void) | undefined;
  let collision: ((object: SceneObject) => boolean) | undefined;
  let open = true;
  const objects = {
    startCatch: vi.fn((_items, callback, speed) => {
      collision = callback;
      void speed;
    }),
    setCatchActive: vi.fn(),
    moveCatcher: vi.fn(),
    steerCatcher: vi.fn(),
  };
  const submit = vi.fn();
  const context = {
    eventBus,
    state: { lifecycle: 'RUNNING' },
    input: {
      subscribe: (handler: (event: InputEvent) => void) => {
        inputHandler = handler;
        return () => {};
      },
    },
    tasks: { current: () => task },
    objects,
    answers: { isOpen: () => open, submit },
  } as unknown as GameContext;
  const mechanic = new FruitCatchMechanic();
  mechanic.initialize(context, { baseSpeed: 140, speedStep: 16 });
  mechanic.start();
  const presented = () =>
    eventBus.emit(
      'TASK_PRESENTED',
      { taskId: task.id, contentId: target.id, curriculumId: 'c', unitId: 'u' },
      'test',
    );
  const audioPlayed = () =>
    eventBus.emit(
      'AUDIO_PLAYED',
      { taskId: task.id, contentId: target.id, audioType: 'PROMPT' },
      'test',
    );
  const object: SceneObject = {
    objectId: 'drop',
    contentId: target.id,
    x: 100,
    y: 100,
    width: 100,
    height: 100,
  };
  return {
    mechanic,
    objects,
    submit,
    presented,
    audioPlayed,
    object,
    getCollision: () => collision,
    getInput: () => inputHandler,
    setOpen: (value: boolean) => (open = value),
  };
}

it('falls faster each round and only submits collisions while answers are open', () => {
  const game = setup();
  game.presented();
  expect(game.objects.startCatch.mock.calls[0]![2]).toBe(140);
  game.audioPlayed();
  expect(game.objects.setCatchActive).toHaveBeenLastCalledWith(true);
  game.setOpen(false);
  expect(game.getCollision()!(game.object)).toBe(false);
  expect(game.submit).not.toHaveBeenCalled();
  game.setOpen(true);
  expect(game.getCollision()!(game.object)).toBe(true);
  expect(game.submit).toHaveBeenCalledWith('apple', 'drop');
  game.presented();
  expect(game.objects.startCatch.mock.calls[1]![2]).toBe(156);
});

it('routes drag and steering, and freezes motion only while paused', () => {
  const game = setup();
  game.presented();
  game.getInput()!({
    type: 'MOVE',
    source: 'TOUCH',
    x: 320,
    y: 500,
    timestamp: 1,
  });
  game.getInput()!({
    type: 'STEER',
    source: 'KEYBOARD',
    direction: -1,
    timestamp: 2,
  });
  expect(game.objects.moveCatcher).toHaveBeenCalledWith(320);
  expect(game.objects.steerCatcher).toHaveBeenLastCalledWith(-1);
  game.mechanic.pause();
  expect(game.objects.setCatchActive).toHaveBeenLastCalledWith(false);
  expect(game.objects.steerCatcher).toHaveBeenLastCalledWith(0);
  game.mechanic.resume();
  expect(game.objects.setCatchActive).toHaveBeenLastCalledWith(true);
  game.getCollision()!(game.object);
  game.mechanic.destroy();
});
