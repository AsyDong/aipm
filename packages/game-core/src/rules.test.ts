import { expect, it } from 'vitest';
import { RewardManager, RuleEngine } from './rules';
import type { LearningTask } from '@english/contracts';

const one = {
  id: 'one',
  text: 'one',
  curriculumId: 'c',
  unitId: 'u',
  assets: { image: '/one.svg', audio: '/one.mp3' },
  source: { kind: 'DEMO' as const, reference: 'test' },
};
const task: LearningTask = {
  id: 'task',
  curriculumId: 'c',
  unitId: 'u',
  target: one,
  candidates: [one, { ...one, id: 'two' }],
};
it('allows retries, tracks attempts, rejects stale answers and prevents duplicate rewards', () => {
  const rules = new RuleEngine();
  rules.initialize({
    rounds: 1,
    allowRetry: true,
    hintPolicy: { enabled: true, afterAttempts: 1 },
  });
  rules.setTask(task);
  expect(rules.evaluate({ taskId: 'task', contentId: 'two' })).toMatchObject({
    correct: false,
    attempts: 1,
    hintAvailable: true,
  });
  expect(() => rules.evaluate({ taskId: 'stale', contentId: 'one' })).toThrow();
  expect(rules.evaluate({ taskId: 'task', contentId: 'one' })).toMatchObject({
    correct: true,
    attempts: 2,
  });
  expect(() => rules.evaluate({ taskId: 'task', contentId: 'one' })).toThrow();
  rules.nextRound();
  expect(rules.isCompleted()).toBe(true);
  const rewards = new RewardManager();
  expect(rewards.grant('task', { type: 'STAR', successReward: 1 })).toBe(1);
  expect(rewards.grant('task', { type: 'STAR', successReward: 1 })).toBe(0);
  expect(rewards.getSummary().stars).toBe(1);
});
