import { expect, it } from 'vitest';
import { EventBus } from '../../game-core/src/events';
import { LearningEventCollector } from './collector';

it('keeps task ownership and learning observations separate from rewards and raw input', () => {
  const bus = new EventBus('g', 's');
  const collector = new LearningEventCollector(
    {
      sessionId: 's',
      gameId: 'g',
      learnerId: 'l',
      mechanicId: 'tap',
      startedAt: 0,
    },
    bus,
  );
  bus.emit('GAME_STARTED', {});
  bus.emit('TASK_PRESENTED', {
    taskId: 't',
    contentId: 'c',
    curriculumId: 'book',
    unitId: 'u',
  });
  bus.emit('AUDIO_PLAYED', {
    taskId: 't',
    contentId: 'c',
    audioType: 'PROMPT',
  });
  bus.emit('AUDIO_PLAYED', {
    taskId: 't',
    contentId: 'c',
    audioType: 'REPLAY',
  });
  bus.emit('VOICE_RECORDED', { taskId: 't' });
  bus.emit('VOICE_FAILED', { taskId: 't', reason: 'NO_SPEECH' });
  bus.emit('VOICE_RECORDED', { taskId: 't' });
  bus.emit('VOICE_RECOGNIZED', { taskId: 't' });
  bus.emit('ANSWER_INCORRECT', {
    taskId: 't',
    contentId: 'other',
    attempts: 1,
  });
  bus.emit('HINT_REQUESTED', { taskId: 't', level: 1 });
  bus.emit('ANSWER_CORRECT', { taskId: 't', contentId: 'c', attempts: 2 });
  bus.emit('ANSWER_CORRECT', { taskId: 't', contentId: 'c', attempts: 2 });
  bus.emit('GAME_COMPLETED', { durationMs: 10 });
  const result = collector.finish()!;
  expect(result.completed).toBe(true);
  expect(result.records).toEqual([
    {
      taskId: 't',
      contentId: 'c',
      curriculumId: 'book',
      unitId: 'u',
      listens: 2,
      hints: 1,
      attempts: 2,
      voiceAttempts: 2,
      recognized: 1,
      completed: true,
      needsReview: true,
    },
  ]);
  bus.emit('TASK_PRESENTED', {
    taskId: 'later',
    contentId: 'later',
    curriculumId: 'b',
    unitId: 'u',
  });
  expect(collector.finish()!.records).toHaveLength(1);
});

it('ignores foreign sessions and unstarted previews, and marks unfinished tasks for review', () => {
  const bus = new EventBus('g', 's');
  const owner = {
    sessionId: 's',
    gameId: 'g',
    learnerId: 'l',
    mechanicId: 'tap',
    startedAt: 0,
  };
  expect(new LearningEventCollector(owner, bus).finish()).toBeUndefined();
  const foreign = new LearningEventCollector(
    { ...owner, sessionId: 'other' },
    bus,
  );
  const collector = new LearningEventCollector(owner, bus);
  bus.emit('GAME_STARTED', {});
  bus.emit('TASK_PRESENTED', {
    taskId: 't',
    contentId: 'c',
    curriculumId: 'b',
    unitId: 'u',
  });
  expect(foreign.finish()).toBeUndefined();
  expect(collector.finish()!.records[0]).toMatchObject({
    completed: false,
    needsReview: true,
  });
});
