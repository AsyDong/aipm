import { expect, it } from 'vitest';
import { ContentResolver, createTasks, parseContents } from './content';
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
it('uses target-specific pictures so the noun alone cannot reveal a counted answer', () => {
  const contents = items.map((item) => ({
    ...item,
    distractors: [2, 4].map((count) => ({
      id: `${item.id}-${count}`,
      text: `${count} ${item.text}`,
      curriculumId: item.curriculumId,
      unitId: item.unitId,
      assets: { image: `/${item.id}-${count}.webp` },
    })),
  }));
  const parsed = parseContents(contents);
  for (const task of createTasks(parsed, 3, 3, () => 0.2)) {
    expect(task.candidates).toHaveLength(3);
    expect(
      task.candidates.every((choice) => choice.id.startsWith(task.target.id)),
    ).toBe(true);
    expect(
      task.candidates.filter((choice) => choice.id === task.target.id),
    ).toHaveLength(1);
  }
  expect(() =>
    parseContents([
      {
        ...contents[0],
        distractors: [{ ...contents[0]!.distractors[0], unitId: 'other' }],
      },
    ]),
  ).toThrow('ownership');
  expect(() =>
    parseContents([
      {
        ...contents[0],
        distractors: [{ ...contents[0]!.distractors[0], id: contents[0]!.id }],
      },
    ]),
  ).toThrow('ownership');
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
it('accepts optional quantity and illustration, rejecting malformed values', () => {
  const counted = { ...items[0], quantity: 3, illustration: '/apple.webp' };
  expect(parseContents([counted])[0]).toMatchObject({
    quantity: 3,
    illustration: '/apple.webp',
  });
  for (const bad of [
    { ...items[0], quantity: 0 },
    { ...items[0], quantity: 2.5 },
    { ...items[0], quantity: 'three' },
    { ...items[0], illustration: '' },
    { ...items[0], illustration: 4 },
  ])
    expect(() => parseContents([bad])).toThrow('quantity or illustration');
});
