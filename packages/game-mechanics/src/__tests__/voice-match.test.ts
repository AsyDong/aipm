import { expect, it, vi } from 'vitest';
import type {
  GameContext,
  InputEvent,
  LearningTask,
  VoiceInputEvent,
} from '@english/contracts';
import { EventBus } from '../../../game-core/src/events';
import { VoiceMatchMechanic } from '../voice-match';

const task = {
  id: 't',
  target: { id: 'x', text: 'Hello', assets: { image: '/x.webp' } },
  candidates: [
    { id: 'x', text: 'Hello' },
    { id: 'y', text: 'World' },
  ],
} as LearningTask;
function setup() {
  const bus = new EventBus('g', 's');
  let send: (input: InputEvent) => void = () => {};
  const answers = {
    isOpen: () => true,
    submit: vi.fn(),
    unrecognized: vi.fn(),
  };
  const show = vi.fn();
  const context = {
    sessionId: 's',
    eventBus: bus,
    state: { lifecycle: 'RUNNING' },
    tasks: { current: () => task },
    answers,
    input: {
      subscribe: (fn: typeof send) => {
        send = fn;
        return vi.fn();
      },
    },
    objects: { show, findByContent: () => ({ objectId: 'o' }) },
  } as unknown as GameContext;
  const mechanic = new VoiceMatchMechanic();
  mechanic.initialize(context);
  mechanic.start();
  const event: VoiceInputEvent = {
    type: 'VOICE',
    source: 'VOICE',
    taskId: 't',
    sessionId: 's',
    text: ' HELLO ',
    confidence: 0.9,
    timestamp: 1,
  };
  return {
    mechanic,
    bus,
    show,
    answers,
    event,
    send: (value: InputEvent) => send(value),
  };
}
it('shows the object, matches known words, reports unknown words and retries unreadable answers', () => {
  const t = setup();
  t.bus.emit('TASK_PRESENTED', {
    taskId: 't',
    contentId: 'x',
    curriculumId: 'c',
    unitId: 'u',
  });
  expect(t.show).toHaveBeenCalledWith([
    { objectId: 't:voice', contentId: 'x', image: '/x.webp' },
  ]);
  t.send({ ...t.event, confidence: 0.2 });
  t.send({ ...t.event, text: '' });
  t.send({ ...t.event, failure: 'TIMEOUT' });
  expect(t.answers.unrecognized.mock.calls).toEqual([
    ['LOW_CONFIDENCE'],
    ['NO_SPEECH'],
    ['TIMEOUT'],
  ]);
  expect(t.answers.submit).not.toHaveBeenCalled();
  t.send(t.event);
  expect(t.answers.submit).toHaveBeenLastCalledWith('x', 'o');
  t.send({ ...t.event, text: 'unknown' });
  expect(t.answers.submit).toHaveBeenLastCalledWith('', 'o');
});
it('ignores stale tasks/sessions, paused input and input after disposal', () => {
  const t = setup();
  t.send({ ...t.event, taskId: 'old' });
  t.send({ ...t.event, sessionId: 'old' });
  t.mechanic.pause();
  t.send(t.event);
  expect(t.answers.submit).not.toHaveBeenCalled();
  t.mechanic.resume();
  t.send(t.event);
  t.mechanic.destroy();
  t.send(t.event);
  expect(t.answers.submit).toHaveBeenCalledTimes(1);
});

it('accepts normalized words without confidence, rejects phrases, and ignores silence markers', () => {
  const t = setup();
  const withoutConfidence = { ...t.event };
  delete withoutConfidence.confidence;
  t.send({ ...withoutConfidence, text: '“ＨＥＬＬＯ!”' });
  expect(t.answers.submit).toHaveBeenLastCalledWith('x', 'o');
  t.send({ ...t.event, text: '[BLANK_AUDIO]' });
  expect(t.answers.unrecognized).toHaveBeenLastCalledWith('NO_SPEECH');
  for (const text of ['hello world', 'hel.lo', 'hellos', 'x']) {
    t.send({ ...t.event, text });
    expect(t.answers.submit).toHaveBeenLastCalledWith('', 'o');
  }
  expect(t.answers.submit).toHaveBeenCalledTimes(5);
});
