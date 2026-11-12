import type {
  GameContext,
  IMechanicPlugin,
  InputEvent,
  PluginMetadata,
  SceneItem,
} from '@english/contracts';
import schema from './count-pack.schema.json';

export const countPackMetadata: PluginMetadata = {
  id: 'count-pack',
  name: 'Count & Pack',
  version: '1.0.0',
  apiVersion: '1.0.0',
  type: 'MECHANIC',
  requiredCapabilities: ['OBJECTS', 'HIT_TEST'],
  capabilities: ['TAP'],
  configSchema: schema,
};

interface BoxRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
const DEFAULT_BOX: BoxRect = { x: 1000, y: 540, width: 260, height: 220 };
/** Always more on the counter than any request, so packing is a real choice. */
const PACK_COUNT = 6;
const COUNT_SHELF = { centerX: 770, baseY: 565 };
const PACK_SHELF = { centerX: 420, baseY: 600 };

export function validateCountPackConfig(config: Record<string, unknown>) {
  const keys = Object.keys(config);
  if (keys.some((key) => key !== 'box'))
    throw new Error('Invalid CountPackConfig');
  const box = (config.box ?? DEFAULT_BOX) as BoxRect;
  for (const key of ['x', 'y', 'width', 'height'] as const)
    if (typeof box[key] !== 'number' || !Number.isFinite(box[key]))
      throw new Error('Invalid CountPackConfig');
  if (box.width <= 0 || box.height <= 0)
    throw new Error('Invalid CountPackConfig');
  return box;
}

/** Where the next packed item lands inside the box, three per row. */
export function boxSlot(box: BoxRect, index: number) {
  return {
    x: box.x - 70 + (index % 3) * 70,
    y: box.y - 35 + Math.floor(index / 3) * 70,
    scale: 0.48,
  };
}

/**
 * The delivery station's two-step task, chosen by content data alone:
 * a numeral target with an illustration means "count the group, tap the number";
 * a counted target (quantity + illustration) means "pack that many, tap the box".
 * The mechanic never parses content ids or text and never judges answers.
 */
export class CountPackMechanic implements IMechanicPlugin {
  private context: GameContext | undefined;
  private offs: (() => void)[] = [];
  private enabled = false;
  private box: BoxRect = DEFAULT_BOX;
  private mode: 'COUNT' | 'PACK' = 'COUNT';
  private questionId = '';
  private packed = 0;
  private packedObjects = new Set<string>();
  private quantities = new Map<number, string>();
  async initialize(context: GameContext, config: Record<string, unknown>) {
    this.box = validateCountPackConfig(config);
    this.context = context;
    const pool = await context.content.resolve(context.definition.content);
    for (const item of pool) {
      if (!item.illustration)
        throw new Error('Count & Pack needs an illustration on every item');
      if (item.quantity !== undefined)
        this.quantities.set(item.quantity, item.id);
    }
    this.offs.push(
      context.input.subscribe((event) => this.handleInput(event)),
      context.eventBus.on('TASK_PRESENTED', () => this.present()),
      context.eventBus.on('ANSWER_INCORRECT', () => {
        if (this.mode === 'PACK') {
          this.packed = 0;
          this.packedObjects.clear();
        }
      }),
    );
  }
  private present() {
    const context = this.context;
    const task = context?.tasks.current();
    if (!context || !task) return;
    this.packed = 0;
    this.packedObjects.clear();
    if (task.target.quantity !== undefined) {
      this.mode = 'PACK';
      // Each delivery round is a fresh box, unlike the picnic's shared basket.
      context.objects.clearCollected?.();
      context.objects.setShelf(PACK_SHELF.centerX, PACK_SHELF.baseY);
      const items: SceneItem[] = Array.from({ length: PACK_COUNT }, (_, i) => ({
        objectId: `${task.id}:pack-${i}`,
        contentId: task.target.id,
        image: task.target.illustration!,
        size: 'SMALL' as const,
      }));
      context.objects.show(items);
      return;
    }
    this.mode = 'COUNT';
    this.questionId = `${task.id}:question`;
    context.objects.setShelf(COUNT_SHELF.centerX, COUNT_SHELF.baseY);
    context.objects.show([
      {
        objectId: this.questionId,
        contentId: `${task.target.id}:question`,
        image: task.target.illustration!,
        size: 'LARGE',
      },
      ...task.candidates.map((candidate, index) => ({
        objectId: `${task.id}:${index}`,
        contentId: candidate.id,
        image: candidate.assets.image,
      })),
    ]);
  }
  start() {
    this.enabled = true;
  }
  pause() {
    this.enabled = false;
  }
  resume() {
    this.enabled = true;
  }
  handleInput(event: InputEvent) {
    const context = this.context;
    const task = context?.tasks.current();
    if (
      event.type !== 'TAP' ||
      !this.enabled ||
      !context ||
      !task ||
      context.state.lifecycle !== 'RUNNING'
    )
      return;
    if (this.mode === 'PACK') {
      if (this.inBox(event.x, event.y)) {
        this.submitBox();
        return;
      }
      if (!context.answers.isOpen() || this.packed >= PACK_COUNT) return;
      const object = context.objects.hitTest(event.x, event.y);
      if (!object || this.packedObjects.has(object.objectId)) return;
      context.eventBus.emit(
        'INPUT_RECEIVED',
        { inputType: 'TAP', source: event.source },
        'count-pack',
      );
      this.packedObjects.add(object.objectId);
      const slot = boxSlot(this.box, this.packed);
      this.packed++;
      context.objects.collect?.(object.objectId, slot);
      return;
    }
    if (!context.answers.isOpen()) return;
    context.eventBus.emit(
      'INPUT_RECEIVED',
      { inputType: 'TAP', source: event.source },
      'count-pack',
    );
    const object = context.objects.hitTest(event.x, event.y);
    // The question picture is for counting, never an answer.
    if (!object || object.objectId === this.questionId) return;
    context.eventBus.emit(
      'OBJECT_SELECTED',
      {
        objectId: object.objectId,
        contentId: object.contentId,
        taskId: task.id,
      },
      'count-pack',
    );
    context.answers.submit(object.contentId, object.objectId);
  }
  private inBox(x: number, y: number) {
    return (
      Math.abs(x - this.box.x) <= this.box.width / 2 &&
      Math.abs(y - this.box.y) <= this.box.height / 2
    );
  }
  /** Tapping the box says "this many": the packed quantity becomes the answer. */
  private submitBox() {
    const context = this.context;
    if (!context?.answers.isOpen()) return;
    const answer = this.quantities.get(this.packed);
    // Quantities no content item names are not judged; the child packs on.
    if (answer) context.answers.submit(answer);
  }
  destroy() {
    this.enabled = false;
    this.offs.splice(0).forEach((off) => off());
    this.packedObjects.clear();
    this.quantities.clear();
    this.context = undefined;
  }
}
