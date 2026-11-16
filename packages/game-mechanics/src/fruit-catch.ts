import type {
  GameContext,
  IMechanicPlugin,
  InputEvent,
  LearningTask,
  PluginMetadata,
  SceneObject,
} from '@english/contracts';
import schema from './fruit-catch.schema.json';

export const fruitCatchMetadata: PluginMetadata = {
  id: 'fruit-catch',
  name: 'Monkey’s Fruit Catch',
  version: '1.0.0',
  apiVersion: '1.0.0',
  type: 'MECHANIC',
  requiredCapabilities: ['OBJECTS', 'CATCH'],
  capabilities: ['DRAG', 'STEER'],
  configSchema: schema,
};

/** Turns moving into the answer action; the shared rules still judge every catch. */
export class FruitCatchMechanic implements IMechanicPlugin {
  private context: GameContext | undefined;
  private offs: (() => void)[] = [];
  private enabled = false;
  private baseSpeed = 140;
  private speedStep = 16;
  private round = 0;

  initialize(context: GameContext, config: Record<string, unknown>) {
    this.context = context;
    this.baseSpeed = (config.baseSpeed as number | undefined) ?? 140;
    this.speedStep = (config.speedStep as number | undefined) ?? 16;
    this.round = 0;
    this.offs.push(
      context.input.subscribe((event) => this.handleInput(event)),
      context.eventBus.on('TASK_PRESENTED', () => this.present()),
      context.eventBus.on('AUDIO_PLAYED', () =>
        context.objects.setCatchActive?.(true),
      ),
    );
  }

  private present() {
    const context = this.context;
    const task = context?.tasks.current();
    if (!context || !task || !context.objects.startCatch)
      throw new Error('Fruit Catch needs a catch-capable scene');
    context.objects.startCatch(
      itemsOf(task),
      (object) => this.caught(object),
      this.baseSpeed + this.round++ * this.speedStep,
    );
  }

  private caught(object: SceneObject) {
    const context = this.context;
    const task = context?.tasks.current();
    if (!context || !task || !this.enabled || !context.answers.isOpen())
      return false;
    context.eventBus.emit(
      'OBJECT_SELECTED',
      {
        objectId: object.objectId,
        contentId: object.contentId,
        taskId: task.id,
      },
      'fruit-catch',
    );
    context.answers.submit(object.contentId, object.objectId);
    return true;
  }

  private handleInput(event: InputEvent) {
    if (!this.enabled || this.context?.state.lifecycle !== 'RUNNING') return;
    if (event.type === 'MOVE') this.context?.objects.moveCatcher?.(event.x);
    if (event.type === 'STEER')
      this.context?.objects.steerCatcher?.(event.direction);
  }

  start() {
    this.enabled = true;
  }
  pause() {
    this.enabled = false;
    this.context?.objects.setCatchActive?.(false);
    this.context?.objects.steerCatcher?.(0);
  }
  resume() {
    this.enabled = true;
    if (this.context?.answers.isOpen())
      this.context.objects.setCatchActive?.(true);
  }
  destroy() {
    this.enabled = false;
    this.offs.splice(0).forEach((off) => off());
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
