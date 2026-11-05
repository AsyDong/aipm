import type {
  EvaluationResult,
  GameDefinition,
  GameSummary,
  IEventBus,
  IRewardManager,
  IRuleEngine,
  ITaskView,
  LearningTask,
} from '@english/contracts';

/**
 * The mechanic-independent round loop: present, evaluate, reward, hint, advance.
 * Mechanics only decide how an answer is collected and call submit().
 */
export class TaskRunner implements ITaskView {
  private tasks: LearningTask[] = [];
  private index = 0;
  private hinted = false;
  private firstTryCorrect = 0;
  private replays = 0;
  private hints = 0;
  constructor(
    private bus: IEventBus,
    private rules: IRuleEngine,
    private rewards: IRewardManager,
    private definition: GameDefinition,
    private sessionId: string,
  ) {}
  /** Resets rules, rewards and counters, then presents the first task. */
  start(tasks: LearningTask[]) {
    if (!tasks.length) throw new Error('No tasks to run');
    this.tasks = tasks;
    this.index = 0;
    this.firstTryCorrect = this.replays = this.hints = 0;
    this.rules.initialize(this.definition.rules);
    this.rewards.reset();
    this.present();
  }
  current() {
    return this.tasks[this.index];
  }
  get round() {
    return this.index + 1;
  }
  get total() {
    return this.tasks.length;
  }
  private present() {
    const task = this.tasks[this.index]!;
    this.rules.setTask(task);
    this.hinted = false;
    this.bus.emit(
      'TASK_PRESENTED',
      {
        taskId: task.id,
        contentId: task.target.id,
        curriculumId: task.curriculumId,
        unitId: task.unitId,
      },
      'learning',
    );
  }
  submit(contentId: string): EvaluationResult {
    const task = this.current();
    if (!task) throw new Error('No active task');
    const answer = { taskId: task.id, contentId };
    this.bus.emit('ANSWER_SUBMITTED', answer, 'learning');
    const result = this.rules.evaluate(answer);
    const payload = { ...answer, attempts: result.attempts };
    this.bus.emit(
      result.correct ? 'ANSWER_CORRECT' : 'ANSWER_INCORRECT',
      payload,
      'rules',
    );
    if (result.correct) {
      if (result.attempts === 1 && !this.hinted) this.firstTryCorrect++;
      const amount = this.rewards.grant(task.id, this.definition.reward);
      this.bus.emit(
        'REWARD_GRANTED',
        { taskId: task.id, rewardType: this.definition.reward.type, amount },
        'rewards',
      );
    }
    return result;
  }
  /** Returns the target content id to highlight, or undefined if no hint is allowed yet. */
  hint() {
    const task = this.current();
    if (!task || !this.rules.canHint()) return undefined;
    this.hints++;
    this.hinted = true;
    this.bus.emit('HINT_REQUESTED', { taskId: task.id, level: 1 }, 'learning');
    return task.target.id;
  }
  /** Call after a successful explicit replay (not after a failed one). */
  replayed() {
    this.replays++;
  }
  /** Advances after a correct answer; false when the last task was finished. */
  next() {
    this.rules.nextRound();
    this.index++;
    if (this.index >= this.tasks.length) return false;
    this.present();
    return true;
  }
  /** Grants the completion bonus once and returns the session summary. */
  finish(durationMs: number): GameSummary {
    const bonus = this.definition.reward.completionBonus ?? 0;
    if (bonus)
      this.rewards.grant('completion', { type: 'STAR', successReward: bonus });
    return {
      sessionId: this.sessionId,
      completed: this.index,
      total: this.tasks.length,
      stars: this.rewards.getSummary().stars,
      firstTryCorrect: this.firstTryCorrect,
      replays: this.replays,
      hints: this.hints,
      durationMs,
    };
  }
}
