/** Local pseudonymous profile; not an authenticated account. */
export interface GameSession {
  sessionId: string;
  learnerId: string;
  gameId: string;
  mechanicId: string;
  startedAt: number;
}
export interface LearningRecord {
  taskId: string;
  contentId: string;
  curriculumId: string;
  unitId: string;
  listens: number;
  hints: number;
  attempts: number;
  voiceAttempts: number;
  recognized: number;
  completed: boolean;
  needsReview: boolean;
}
/** One immutable snapshot per session, retried with the same session ID. */
export interface LearningSubmission {
  version: '1.0.0';
  session: GameSession;
  endedAt: number;
  completed: boolean;
  records: LearningRecord[];
}
export interface LearningProgress {
  contentId: string;
  curriculumId: string;
  unitId: string;
  sessions: number;
  completions: number;
  listens: number;
  hints: number;
  attempts: number;
  voiceAttempts: number;
  recognized: number;
  needsReview: boolean;
  lastPracticedAt: number;
}
export interface LearningOptions {
  learnerId: string;
  save(submission: LearningSubmission): void;
}
