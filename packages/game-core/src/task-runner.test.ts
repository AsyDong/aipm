import { expect, it } from 'vitest';
import { EventBus } from './events';
import { RewardManager, RuleEngine } from './rules';
import { TaskRunner } from './task-runner';
import type {
  GameDefinition,
  GameEventType,
  LearningContent,
  LearningTask,
} from '@english/contracts';

const content = (id: string): LearningContent => ({
  id,
  text: id,
  curriculumId: 'c',
  unitId: 'u',
  assets: { image: `/${id}.svg`, audio: `/${id}.mp3` },
  source: { kind: 'DEMO', reference: 'test' },
});
const [a, b, c] = ['a', 'b', 'c'].map(content) as [
  LearningContent,
  LearningContent,
  LearningContent,
];
const tasks: LearningTask[] = [
  { id: 't1', curriculumId: 'c', unitId: 'u', target: a, candidates: [a, b] },
  { id: 't2', curriculumId: 'c', unitId: 'u', target: c, candidates: [b, c] },
];
const definition = {
  rules: {
    rounds: 2,
    allowRetry: true,
    hintPolicy: { enabled: true, afterAttempts: 1 },
  },
  reward: { type: 'STAR', successReward: 1, completionBonus: 2 },
} as GameDefinition;

function setup() {
  const bus = new EventBus('g', 's');
  const seen: GameEventType[] = [];
  for (const type of [
    'TASK_PRESENTED',
    'ANSWER_SUBMITTED',
    'ANSWER_CORRECT',
    'ANSWER_INCORRECT',
    'REWARD_GRANTED',
    'HINT_REQUESTED',
    'VOICE_FAILED',
  ] as const)
    bus.on(type, () => seen.push(type));
  const runner = new TaskRunner(
    bus,
    new RuleEngine(),
    new RewardManager(),
    definition,
    's',
  );
  return { runner, seen };
}

it('runs the whole round loop independent of any mechanic or Phaser', () => {
  const { runner, seen } = setup();
  runner.start(tasks);
  expect(runner.current()?.id).toBe('t1');
  expect(runner.hint()).toBeUndefined(); // no hint before an attempt
  expect(runner.submit('b').correct).toBe(false);
  expect(runner.hint()).toBe('a');
  expect(runner.submit('a').correct).toBe(true);
  runner.replayed();
  expect(runner.next()).toBe(true);
  expect(runner.current()?.id).toBe('t2');
  expect(runner.submit('c').correct).toBe(true); // first try, no hint
  expect(runner.next()).toBe(false);
  const summary = runner.finish(1234);
  expect(summary).toMatchObject({
    sessionId: 's',
    completed: 2,
    total: 2,
    stars: 4, // 2 answers + completion bonus 2
    firstTryCorrect: 1, // t1 needed a retry and a hint
    replays: 1,
    hints: 1,
    durationMs: 1234,
  });
  expect(seen.filter((t) => t === 'TASK_PRESENTED')).toHaveLength(2);
  expect(seen.filter((t) => t === 'REWARD_GRANTED')).toHaveLength(2);
});

it('does not pay twice for repeated answers and restarts cleanly', () => {
  const { runner } = setup();
  runner.start(tasks);
  runner.submit('a');
  expect(() => runner.submit('a')).toThrow();
  runner.start(tasks);
  expect(runner.round).toBe(1);
  runner.submit('a');
  runner.next();
  runner.submit('c');
  runner.next();
  expect(runner.finish(0).stars).toBe(4);
  expect(() => runner.start([])).toThrow();
});

it('treats an unreadable answer as neither wrong nor right: no attempt, no penalty, no hint unlocked', () => {
  const { runner, seen } = setup();
  runner.start(tasks);
  runner.unrecognized('NO_SPEECH');
  runner.unrecognized('LOW_CONFIDENCE');
  expect(seen.filter((t) => t === 'VOICE_FAILED')).toHaveLength(2);
  expect(seen).not.toContain('ANSWER_INCORRECT');
  expect(runner.hint()).toBeUndefined(); // still zero attempts
  const result = runner.submit('a');
  expect(result).toMatchObject({ correct: true, attempts: 1 });
});

it('counts a spoken word outside the candidates as a wrong answer, not an exception', () => {
  const { runner } = setup();
  runner.start(tasks);
  expect(runner.submit('not-a-candidate')).toMatchObject({
    correct: false,
    attempts: 1,
  });
});
