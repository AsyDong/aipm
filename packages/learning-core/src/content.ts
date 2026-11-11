import type {
  ContentDefinition,
  IContentResolver,
  LearningContent,
  LearningTask,
} from '@english/contracts';

export class ContentResolver implements IContentResolver {
  private items: Map<string, LearningContent>;
  constructor(contents: LearningContent[]) {
    this.items = new Map(contents.map((content) => [content.id, content]));
    if (this.items.size !== contents.length)
      throw new Error('Duplicate content ID');
  }
  async resolve(definition: ContentDefinition) {
    const seen = new Set<string>();
    return definition.items.map((reference) => {
      const content = this.items.get(reference.contentId);
      if (
        !content ||
        content.curriculumId !== definition.curriculumId ||
        content.unitId !== definition.unitId
      )
        throw new Error(`Invalid content ownership: ${reference.contentId}`);
      if (seen.has(content.id)) throw new Error('Duplicate content reference');
      seen.add(content.id);
      return {
        ...content,
        assets: { ...content.assets, ...reference.assetOverrides },
      };
    });
  }
}

export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

export function createTasks(
  contents: LearningContent[],
  rounds: number,
  optionCount: number,
  random = Math.random,
  progression: 'SEQUENTIAL' | 'RANDOM' = 'RANDOM',
): LearningTask[] {
  if (contents.length < 2 || optionCount < 2)
    throw new Error('At least two candidates required');
  const targets =
    progression === 'SEQUENTIAL' ? contents : shuffle(contents, random);
  return Array.from({ length: rounds }, (_, index) => {
    const target = targets[index % targets.length]!;
    const distractors = shuffle(
      target.distractors ?? contents.filter((item) => item.id !== target.id),
      random,
    ).slice(0, optionCount - 1);
    return {
      // Unique within a session; deterministic ids keep tests and replays reproducible.
      id: `task-${index + 1}:${target.id}`,
      curriculumId: target.curriculumId,
      unitId: target.unitId,
      target,
      candidates: shuffle([target, ...distractors], random),
    };
  });
}

type Dict = Record<string, unknown>;
const isDict = (value: unknown): value is Dict =>
  typeof value === 'object' && value !== null;
const text = (value: unknown) => typeof value === 'string' && value.length > 0;

/** Validates untrusted content data (e.g. a JSON file) before it reaches the game. */
export function parseContents(raw: unknown): LearningContent[] {
  if (!Array.isArray(raw)) throw new Error('Content must be an array');
  return raw.map((item: unknown, i) => {
    const assets = isDict(item) ? item.assets : undefined;
    const source = isDict(item) ? item.source : undefined;
    const ok =
      isDict(item) &&
      [item.id, item.curriculumId, item.unitId, item.text].every(text) &&
      isDict(assets) &&
      text(assets.image) &&
      text(assets.audio) &&
      isDict(source) &&
      text(source.reference) &&
      (source.kind === 'CURRICULUM' || source.kind === 'DEMO');
    if (!ok) throw new Error(`Invalid content entry #${i}`);
    if (item.distractors !== undefined) {
      if (!Array.isArray(item.distractors) || item.distractors.length < 1)
        throw new Error(`Invalid distractors #${i}`);
      const ids = new Set([item.id]);
      for (const choice of item.distractors) {
        if (
          !isDict(choice) ||
          !text(choice.id) ||
          !text(choice.text) ||
          choice.curriculumId !== item.curriculumId ||
          choice.unitId !== item.unitId ||
          !isDict(choice.assets) ||
          !text(choice.assets.image) ||
          ids.has(choice.id)
        )
          throw new Error(`Invalid distractor ownership or picture #${i}`);
        ids.add(choice.id);
      }
    }
    return item as unknown as LearningContent;
  });
}
