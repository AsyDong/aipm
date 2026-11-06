import type {
  GameContext,
  IMechanicPlugin,
  PluginRegistration,
} from '@english/contracts';

/** Test-only reaction: answer only after a configurable delay, using scene hit tests. */
class ReactionMechanic implements IMechanicPlugin {
  private active = false;
  private readyAt = Infinity;
  private off: (() => void)[] = [];
  initialize(context: GameContext, config: Record<string, unknown>) {
    this.off = [
      context.eventBus.on('TASK_PRESENTED', () => {
        const task = context.tasks.current();
        if (!task) return;
        this.readyAt = Date.now() + Number(config.delayMs);
        context.objects.show(
          task.candidates.map((item, i) => ({
            objectId: `${task.id}:${i}`,
            contentId: item.id,
            image: item.assets.image,
          })),
        );
      }),
      context.input.subscribe((event) => {
        if (
          !this.active ||
          event.type !== 'TAP' ||
          Date.now() < this.readyAt ||
          !context.answers.isOpen()
        )
          return;
        const object = context.objects.hitTest(event.x, event.y);
        if (object) context.answers.submit(object.contentId, object.objectId);
      }),
    ];
  }
  start() {
    this.active = true;
  }
  pause() {
    this.active = false;
  }
  resume() {
    this.active = true;
  }
  destroy() {
    this.active = false;
    this.off.splice(0).forEach((off) => off());
  }
}

export const reactionFixture: PluginRegistration = {
  metadata: {
    id: 'reaction-test',
    name: 'Reaction test',
    version: '1.0.0',
    apiVersion: '1.0.0',
    type: 'MECHANIC',
    requiredCapabilities: ['OBJECTS', 'HIT_TEST'],
    capabilities: ['TAP'],
    configSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['delayMs'],
      properties: { delayMs: { type: 'integer', minimum: 0, maximum: 1000 } },
    },
  },
  create: () => new ReactionMechanic(),
};
