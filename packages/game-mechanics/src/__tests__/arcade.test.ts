import { expect, it, vi } from 'vitest';
import { EventBus } from '../../../game-core/src/events';
import type {
  ArcadeAction,
  GameContext,
  InputEvent,
  LearningContent,
  LearningTask,
  SceneObject,
} from '@english/contracts';
import { ArcadeMechanic } from '../arcade';

const item = (id: string): LearningContent => ({
  id,
  curriculumId: 'c',
  unitId: 'u',
  text: id,
  assets: { image: `/${id}.webp`, audio: `/${id}.mp3` },
  source: { reference: 'test', kind: 'DEMO' },
});

function setup() {
  const apple = item('apple');
  const banana = item('banana');
  const task: LearningTask = {
    id: 'task',
    curriculumId: 'c',
    unitId: 'u',
    target: apple,
    candidates: [apple, banana],
  };
  const eventBus = new EventBus('game', 'session');
  let input: ((event: InputEvent) => void) | undefined;
  let action: ArcadeAction | undefined;
  let open = true;
  const objects = {
    startArcade: vi.fn(
      (
        _mode: string,
        _items: unknown,
        callback: ArcadeAction,
        round: number,
      ) => {
        void round;
        action = callback;
      },
    ),
    setArcadeActive: vi.fn(),
    arcadeInput: vi.fn(),
  };
  const submit = vi.fn((contentId: string) => {
    if (contentId === 'apple') open = false;
  });
  const context = {
    eventBus,
    state: { lifecycle: 'RUNNING' },
    input: {
      subscribe: (handler: typeof input) => ((input = handler), () => {}),
    },
    tasks: { current: () => task },
    objects,
    answers: { isOpen: () => open, submit },
  } as unknown as GameContext;
  const mechanic = new ArcadeMechanic();
  mechanic.initialize(context, { mode: 'word-golf' });
  mechanic.start();
  eventBus.emit(
    'TASK_PRESENTED',
    { taskId: task.id, contentId: apple.id, curriculumId: 'c', unitId: 'u' },
    'test',
  );
  const object: SceneObject = {
    objectId: 'ball-target',
    contentId: 'apple',
    x: 100,
    y: 100,
    width: 100,
    height: 100,
  };
  return {
    mechanic,
    eventBus,
    objects,
    submit,
    object,
    action: () => action!,
    input: (event: InputEvent) => input!(event),
    close: () => (open = false),
  };
}

it('passes candidates and actions through the shared answer port', () => {
  const game = setup();
  expect(game.objects.startArcade.mock.calls[0]![0]).toBe('word-golf');
  expect(game.objects.startArcade.mock.calls[0]![3]).toBe(0);
  expect(game.objects.startArcade.mock.calls[0]![1]).toHaveLength(2);
  game.eventBus.emit(
    'AUDIO_PLAYED',
    { taskId: 'task', contentId: 'apple', audioType: 'PROMPT' },
    'test',
  );
  expect(game.objects.setArcadeActive).toHaveBeenCalledWith(true);
  game.input({ type: 'TAP', source: 'MOUSE', x: 20, y: 30, timestamp: 1 });
  expect(game.objects.arcadeInput).toHaveBeenCalled();
  expect(game.action()(game.object)).toBe('CORRECT');
  expect(game.submit).toHaveBeenCalledWith('apple', 'ball-target');
  expect(game.action()(game.object)).toBe(false);
});

it('keeps retries open, increments rounds and blocks actions while paused', () => {
  const game = setup();
  expect(game.action()({ ...game.object, contentId: 'banana' })).toBe('RETRY');
  game.mechanic.pause();
  expect(game.action()(game.object)).toBe(false);
  game.mechanic.resume();
  game.close();
  expect(game.action()(game.object)).toBe(false);
  game.eventBus.emit(
    'TASK_PRESENTED',
    { taskId: 'task-2', contentId: 'apple', curriculumId: 'c', unitId: 'u' },
    'test',
  );
  expect(game.objects.startArcade.mock.calls[1]![3]).toBe(1);
});
