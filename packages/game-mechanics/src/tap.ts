import type {
  GameContext,
  IMechanicPlugin,
  InputEvent,
  LearningTask,
  PluginMetadata,
} from '@english/contracts';

export const tapMetadata: PluginMetadata = {
  id: 'tap',
  name: 'Listen & Find',
  version: '1.0.0',
  apiVersion: '1.0.0',
  type: 'MECHANIC',
  requiredCapabilities: ['OBJECTS', 'HIT_TEST'],
  capabilities: ['TAP'],
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: { selectionMode: { const: 'SINGLE' } },
  },
};
export class TapMechanic implements IMechanicPlugin {
  private context: GameContext | undefined;
  private task: LearningTask | undefined;
  private off = () => {};
  private enabled = false;
  initialize(context: GameContext) {
    this.context = context;
    this.off = context.input.subscribe((event) => this.handleInput(event));
  }
  present(task: LearningTask) {
    this.task = task;
    this.context?.objects.show(task);
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
    if (
      !this.enabled ||
      !context ||
      !this.task ||
      context.state.lifecycle !== 'RUNNING'
    )
      return;
    const object = context.objects.hitTest(event.x, event.y);
    if (object)
      context.eventBus.emit(
        'OBJECT_SELECTED',
        {
          objectId: object.objectId,
          contentId: object.contentId,
          taskId: this.task.id,
        },
        'tap',
      );
  }
  destroy() {
    this.off();
    this.enabled = false;
    this.context = undefined;
    this.task = undefined;
  }
}
