import type {
  AssetReference,
  GameContext,
  IMechanicPlugin,
  InputEvent,
  PluginMetadata,
  SceneObject,
  SliceConfig,
  SwipeInputEvent,
} from '@english/contracts';
import schema from './slice.schema.json';

export const SLICE_SOUND = '/audio/effects/slice.mp3';
export const sliceAssets = (): AssetReference[] => [
  { key: SLICE_SOUND, type: 'AUDIO', url: SLICE_SOUND, version: '1.0.0' },
];
export const sliceMetadata: PluginMetadata = {
  id: 'slice',
  name: 'Listen & Slice',
  version: '1.0.0',
  apiVersion: '1.0.0',
  type: 'MECHANIC',
  requiredCapabilities: ['OBJECTS', 'SLICE'],
  capabilities: ['SWIPE'],
  configSchema: schema,
};

/** Schema is used by the registry; this guard also covers direct initialization. */
export function validateSliceConfig(
  config: Record<string, unknown>,
): SliceConfig {
  if (
    Object.keys(config).some((key) => key !== 'minDistance') ||
    (config.minDistance !== undefined &&
      (typeof config.minDistance !== 'number' ||
        !Number.isFinite(config.minDistance) ||
        config.minDistance < 12 ||
        config.minDistance > 100))
  )
    throw new Error('Invalid SliceConfig');
  return { minDistance: (config.minDistance as number | undefined) ?? 32 };
}

/** Segment/slab intersection returns distance along the segment, including boundary hits. */
export function segmentHit(
  a: { x: number; y: number },
  b: { x: number; y: number },
  object: SceneObject,
): number | undefined {
  let enter = 0;
  let leave = 1;
  for (const [start, delta, center, half] of [
    [a.x, b.x - a.x, object.x, object.width / 2],
    [a.y, b.y - a.y, object.y, object.height / 2],
  ] as const) {
    if (delta === 0) {
      if (start < center - half || start > center + half) return;
    } else {
      const t1 = (center - half - start) / delta;
      const t2 = (center + half - start) / delta;
      enter = Math.max(enter, Math.min(t1, t2));
      leave = Math.min(leave, Math.max(t1, t2));
      if (enter > leave) return;
    }
  }
  return enter;
}

export function firstSwipeHit(
  points: SwipeInputEvent['points'],
  objects: SceneObject[],
): SceneObject | undefined {
  for (let i = 1; i < points.length; i++) {
    let first: SceneObject | undefined;
    let distance = Infinity;
    for (const object of objects) {
      const hit = segmentHit(points[i - 1]!, points[i]!, object);
      if (hit !== undefined && hit < distance) {
        first = object;
        distance = hit;
      }
    }
    if (first) return first;
  }
}

export class SliceMechanic implements IMechanicPlugin {
  private context: GameContext | undefined;
  private offs: (() => void)[] = [];
  private enabled = false;
  private cut = new Set<string>();
  private minDistance = 32;
  initialize(context: GameContext, config: Record<string, unknown>) {
    this.minDistance = validateSliceConfig(config).minDistance!;
    if (!context.objects.slice)
      throw new Error('Slice requires object slicing');
    this.context = context;
    this.offs.push(
      context.input.subscribe((event) => this.handleInput(event)),
      context.eventBus.on('TASK_PRESENTED', () => {
        this.cut.clear();
        const task = context.tasks.current();
        if (task)
          context.objects.show(
            task.candidates.map((item, i) => ({
              objectId: `${task.id}:${i}`,
              contentId: item.id,
              image: item.assets.image,
            })),
          );
      }),
    );
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
      event.type !== 'SWIPE' ||
      !this.enabled ||
      !context ||
      !task ||
      context.state.lifecycle !== 'RUNNING' ||
      !context.answers.isOpen()
    )
      return;
    const points = event.points;
    const length = points
      .slice(1)
      .reduce(
        (total, point, i) =>
          total + Math.hypot(point.x - points[i]!.x, point.y - points[i]!.y),
        0,
      );
    if (length < this.minDistance) return;
    const objects = task.candidates.flatMap((candidate) => {
      const object = context.objects.findByContent(candidate.id);
      return object && !this.cut.has(object.objectId) ? [object] : [];
    });
    const hit = firstSwipeHit(points, objects);
    if (!hit) return;
    this.cut.add(hit.objectId); // Mark before events: listeners may synchronously dispatch again.
    context.eventBus.emit(
      'INPUT_RECEIVED',
      { inputType: 'SWIPE', source: event.source },
      'slice',
    );
    context.eventBus.emit(
      'OBJECT_SELECTED',
      { objectId: hit.objectId, contentId: hit.contentId, taskId: task.id },
      'slice',
    );
    context.objects.slice?.(hit.objectId);
    context.answers.submit(hit.contentId, hit.objectId);
  }
  destroy() {
    this.enabled = false;
    this.offs.splice(0).forEach((off) => off());
    this.cut.clear();
    this.context = undefined;
  }
}
