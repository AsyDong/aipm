import type {
  GameSession,
  IEventBus,
  LearningRecord,
  LearningSubmission,
} from '@english/contracts';

/** Subscribes only to learning facts; never stores text, audio or coordinates. */
export class LearningEventCollector {
  private records = new Map<string, LearningRecord>();
  private off: (() => void)[];
  private completed = false;
  private started = false;
  constructor(
    private session: GameSession,
    bus: IEventBus,
  ) {
    const owns = (event: { sessionId: string; gameId: string }) =>
      event.sessionId === session.sessionId && event.gameId === session.gameId;
    this.off = [
      bus.on('GAME_STARTED', (event) => {
        if (owns(event)) {
          this.started = true;
          this.session = { ...session, startedAt: event.timestamp };
        }
      }),
      bus.on('TASK_PRESENTED', (event) => {
        if (!owns(event) || !this.started) return;
        const p = event.payload;
        if (!this.records.has(p.taskId))
          this.records.set(p.taskId, {
            ...p,
            listens: 0,
            hints: 0,
            attempts: 0,
            voiceAttempts: 0,
            recognized: 0,
            completed: false,
            needsReview: true,
          });
      }),
      ...(
        [
          'AUDIO_PLAYED',
          'HINT_REQUESTED',
          'ANSWER_CORRECT',
          'ANSWER_INCORRECT',
          'VOICE_RECORDED',
          'VOICE_RECOGNIZED',
          'VOICE_FAILED',
        ] as const
      ).map((type) =>
        bus.on(type, (event) => {
          if (!owns(event)) return;
          const record = this.records.get(event.payload.taskId);
          if (!record || record.completed) return;
          if (type === 'AUDIO_PLAYED') record.listens++;
          if (type === 'HINT_REQUESTED') record.hints++;
          if (type === 'VOICE_RECORDED') record.voiceAttempts++;
          if (type === 'VOICE_RECOGNIZED') record.recognized++;
          if ('attempts' in event.payload)
            record.attempts = Math.max(record.attempts, event.payload.attempts);
          if (type === 'ANSWER_CORRECT') record.completed = true;
          record.needsReview =
            !record.completed || record.hints > 0 || record.attempts > 1;
        }),
      ),
      bus.on('GAME_COMPLETED', (event) => {
        if (owns(event)) this.completed = true;
      }),
    ];
  }
  finish(endedAt = Date.now()): LearningSubmission | undefined {
    for (const off of this.off.splice(0)) off();
    if (!this.started) return undefined;
    return {
      version: '1.0.0',
      session: { ...this.session },
      endedAt,
      completed: this.completed,
      records: [...this.records.values()].map((record) => ({ ...record })),
    };
  }
}
