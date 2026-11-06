import type { LearningSubmission } from '@english/contracts';

const PREFIX = 'english-adventure:learning:';
const PROFILE = 'english-adventure:learner';
const LIMIT = 200;

export function learnerId(): string {
  let id = localStorage.getItem(PROFILE);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(PROFILE, id);
  }
  return id;
}

/** Per-session keys prevent one tab's acknowledgement from deleting another's work. */
export class LearningOutbox {
  private running = false;
  constructor(
    private storage: Storage,
    private request: typeof fetch = fetch,
  ) {}
  pending() {
    return Array.from({ length: this.storage.length }, (_, i) =>
      this.storage.key(i),
    ).filter((key): key is string => !!key?.startsWith(PREFIX));
  }
  save(submission: LearningSubmission) {
    const key = PREFIX + submission.session.sessionId;
    const body = JSON.stringify(submission);
    const existing = this.storage.getItem(key);
    if (existing && existing !== body) throw new Error('Session already saved');
    if (!existing && this.pending().length >= LIMIT)
      throw new Error('Learning storage is full. Connect and retry.');
    this.storage.setItem(key, body);
  }
  async flush() {
    if (this.running) return;
    this.running = true;
    try {
      for (const key of this.pending().slice(0, 20)) {
        const body = this.storage.getItem(key);
        if (!body) continue;
        const response = await this.request('/api/v1/game-sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error('Learning sync unavailable');
        // Never acknowledge a different snapshot, including unexpected server replies.
        const ack: unknown = await response.json();
        const submission = JSON.parse(body) as LearningSubmission;
        if (
          !ack ||
          typeof ack !== 'object' ||
          !('sessionId' in ack) ||
          ack.sessionId !== submission.session.sessionId
        )
          throw new Error('Invalid learning acknowledgement');
        if (this.storage.getItem(key) === body) this.storage.removeItem(key);
      }
    } finally {
      this.running = false;
    }
  }
}
