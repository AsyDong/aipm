import { expect, it } from 'vitest';
import { ContentResolver, createTasks } from './content';
const items = ['one', 'two', 'three'].map((id) => ({
  id,
  text: id,
  curriculumId: 'c',
  unitId: 'u',
  assets: { image: `/${id}.svg`, audio: `/${id}.mp3` },
  source: { kind: 'DEMO' as const, reference: 'test' },
}));
it('resolves explicit ownership and rejects missing, duplicated or cross-unit content', async () => {
  const resolver = new ContentResolver(items);
  const definition = {
    curriculumId: 'c',
    unitId: 'u',
    items: [{ contentId: 'one' }],
  };
  expect(await resolver.resolve(definition)).toEqual([items[0]]);
  await expect(
    resolver.resolve({ ...definition, unitId: 'other' }),
  ).rejects.toThrow('ownership');
  await expect(
    resolver.resolve({ ...definition, items: [{ contentId: 'missing' }] }),
  ).rejects.toThrow();
  await expect(
    resolver.resolve({
      ...definition,
      items: [...definition.items, ...definition.items],
    }),
  ).rejects.toThrow('Duplicate');
});
it('builds attributed tasks with one target, unique candidates and no content-dependent mechanism', () => {
  const tasks = createTasks(items, 5, 3, () => 0.2);
  expect(tasks).toHaveLength(5);
  expect(new Set(tasks.slice(0, 3).map((task) => task.target.id)).size).toBe(3);
  for (const task of tasks) {
    expect(task.curriculumId).toBe('c');
    expect(task.unitId).toBe('u');
    expect(
      task.candidates.filter((item) => item.id === task.target.id),
    ).toHaveLength(1);
    expect(new Set(task.candidates.map((item) => item.id)).size).toBe(3);
  }
});
