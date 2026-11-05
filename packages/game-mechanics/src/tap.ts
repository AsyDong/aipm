import type {
  GameContext,
  IMechanicPlugin,
  InputEvent,
  LearningTask,
  PluginMetadata,
} from '@english/contracts';
import schema from './tap.schema.json';

export const tapMetadata: PluginMetadata = {
  id: 'tap',
  name: 'Listen & Find',
  version: '1.0.0',
  apiVersion: '1.0.0',
  type: 'MECHANIC',
  requiredCapabilities: ['OBJECTS', 'HIT_TEST'],
  capabilities: ['TAP'],
  configSchema: schema,
};

/**
 * Shows each presented task's candidates and turns taps into OBJECT_SELECTED.
 * It never judges answers and never names curriculum content.
 */
export class TapMechanic implements IMechanicPlugin {
  private context: GameContext | undefined;
  private offs: (() => void)[] = [];
  private enabled = false;
  initialize(context: GameContext) {
    this.context = context;
    this.offs.push(
      context.input.subscribe((event) => this.handleInput(event)),
      context.eventBus.on('TASK_PRESENTED', () => this.present()),
    );
  }
  private present() {
    const task = this.context?.tasks.current();
    if (task) this.context?.objects.show(itemsOf(task));
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
    context.eventBus.emit(
      'INPUT_RECEIVED',
      { inputType: 'TAP', source: event.source },
      'tap',
    );
    const object = context.objects.hitTest(event.x, event.y);
    if (object)
      context.eventBus.emit(
        'OBJECT_SELECTED',
        {
          objectId: object.objectId,
          contentId: object.contentId,
          taskId: task.id,
        },
        'tap',
      );
  }
  destroy() {
    for (const off of this.offs.splice(0)) off();
    this.enabled = false;
    this.context = undefined;
  }
}

function itemsOf(task: LearningTask) {
  return task.candidates.map((content, index) => ({
    objectId: `${task.id}:${index}`,
    contentId: content.id,
    image: content.assets.image,
  }));
}
