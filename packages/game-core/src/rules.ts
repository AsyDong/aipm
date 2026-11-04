import type {
  IRuleEngine,
  LearningTask,
  PlayerAnswer,
  RuleDefinition,
  IRewardManager,
  RewardDefinition,
} from '@english/contracts';

export class RuleEngine implements IRuleEngine {
  private config: RuleDefinition = { allowRetry: true };
  private task: LearningTask | undefined;
  private attempts = 0;
  private rounds = 0;
  private solved = false;
  initialize(config: RuleDefinition) {
    this.config = config;
    this.reset();
  }
  setTask(task: LearningTask) {
    this.task = task;
    this.attempts = 0;
    this.solved = false;
  }
  evaluate(answer: PlayerAnswer) {
    if (!this.task || answer.taskId !== this.task.id || this.solved)
      throw new Error('Stale or completed task');
    if (!this.task.candidates.some((item) => item.id === answer.contentId))
      throw new Error('Invalid candidate');
    this.attempts++;
    const correct = answer.contentId === this.task.target.id;
    this.solved = correct;
    return {
      correct,
      attempts: this.attempts,
      completed: correct,
      hintAvailable: Boolean(
        this.config.hintPolicy?.enabled &&
        this.attempts >= (this.config.hintPolicy.afterAttempts ?? 1),
      ),
    };
  }
  nextRound() {
    if (!this.solved) throw new Error('Task not complete');
    this.rounds++;
  }
  isCompleted() {
    return this.rounds >= (this.config.rounds ?? 1);
  }
  reset() {
    this.task = undefined;
    this.attempts = 0;
    this.rounds = 0;
    this.solved = false;
  }
}
export class RewardManager implements IRewardManager {
  private granted = new Set<string>();
  private stars = 0;
  grant(taskId: string, config: RewardDefinition) {
    if (this.granted.has(taskId)) return 0;
    this.granted.add(taskId);
    this.stars += config.successReward;
    return config.successReward;
  }
  getSummary() {
    return { stars: this.stars };
  }
  reset() {
    this.granted.clear();
    this.stars = 0;
  }
}
