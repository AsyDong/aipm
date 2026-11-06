import { expect, it, vi } from 'vitest';
import type { LearningSubmission } from '@english/contracts';
import { LearningOutbox } from '../../../apps/web/src/learning';

function storage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    clear: () => values.clear(),
  };
}
const submission: LearningSubmission = {
  version: '1.0.0',
  session: {
    sessionId: 's',
    learnerId: 'l',
    gameId: 'g',
    mechanicId: 'tap',
    startedAt: 1,
  },
  endedAt: 2,
  completed: false,
  records: [],
};
it('retains network failures across reload, retries unchanged and removes acknowledged sessions', async () => {
  const store = storage();
  const offline = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'));
  const first = new LearningOutbox(store, offline);
  first.save(submission);
  await expect(first.flush()).rejects.toThrow('offline');
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(JSON.stringify({ sessionId: 's' })));
  const reloaded = new LearningOutbox(store, request);
  expect(reloaded.pending()).toHaveLength(1);
  await reloaded.flush();
  expect(reloaded.pending()).toEqual([]);
  expect(request.mock.calls[0]![1]!.body).toBe(offline.mock.calls[0]![1]!.body);
});
it('keeps mismatched responses and bounds capacity', async () => {
  const store = storage();
  const outbox = new LearningOutbox(
    store,
    vi.fn<typeof fetch>().mockResolvedValue(new Response('{}')),
  );
  outbox.save(submission);
  await expect(outbox.flush()).rejects.toThrow('acknowledgement');
  expect(outbox.pending()).toHaveLength(1);
  for (let i = 1; i < 200; i++)
    outbox.save({
      ...submission,
      session: { ...submission.session, sessionId: String(i) },
    });
  expect(() =>
    outbox.save({
      ...submission,
      session: { ...submission.session, sessionId: 'overflow' },
    }),
  ).toThrow('full');
});
