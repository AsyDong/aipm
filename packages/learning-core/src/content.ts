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
      contents.filter((item) => item.id !== target.id),
      random,
    ).slice(0, optionCount - 1);
    return {
      id: crypto.randomUUID(),
      curriculumId: target.curriculumId,
      unitId: target.unitId,
      target,
      candidates: shuffle([target, ...distractors], random),
    };
  });
}
