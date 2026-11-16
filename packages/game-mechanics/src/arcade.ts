import type {
  ArcadeAnswer,
  ArcadeMode,
  GameContext,
  IMechanicPlugin,
  InputEvent,
  LearningTask,
  PluginMetadata,
  SceneObject,
} from '@english/contracts';
import { ARCADE_MODES } from '@english/contracts';
import schema from './arcade.schema.json';

export const arcadeMetadata: PluginMetadata = {
  id: 'arcade',
  name: 'Learning Arcade',
  version: '1.0.0',
  apiVersion: '1.0.0',
  type: 'MECHANIC',
  requiredCapabilities: ['OBJECTS', 'ARCADE'],
  capabilities: ['TAP', 'DRAG', 'SWIPE', 'STEER', 'ANIMATION'],
  configSchema: schema,
};

/** Converts each arcade's physical action into the one shared answer pipeline. */
export class ArcadeMechanic implements IMechanicPlugin {
  private context: GameContext | undefined;
  private offs: (() => void)[] = [];
  private enabled = false;
  private mode: ArcadeMode = 'picture-pairs';
  private round = 0;

  initialize(context: GameContext, config: Record<string, unknown>) {
    const mode = config.mode as ArcadeMode;
    if (!ARCADE_MODES.includes(mode)) throw new Error('Unknown arcade mode');
    this.context = context;
    this.mode = mode;
    this.round = 0;
    this.offs.push(
      context.input.subscribe((event) => this.handleInput(event)),
      context.eventBus.on('TASK_PRESENTED', () => this.present()),
      context.eventBus.on('AUDIO_PLAYED', () =>
        context.objects.setArcadeActive?.(true),
      ),
    );
  }

  private present() {
    const context = this.context;
    const task = context?.tasks.current();
    if (!context || !task || !context.objects.startArcade)
      throw new Error('Arcade needs an arcade-capable scene');
    context.objects.startArcade(
      this.mode,
      itemsOf(task),
      (object) => this.act(object),
      this.round++,
    );
  }

  private act(object: SceneObject): ArcadeAnswer | false {
    const context = this.context;
    const task = context?.tasks.current();
    if (
      !context ||
      !task ||
      !this.enabled ||
      context.state.lifecycle !== 'RUNNING' ||
      !context.answers.isOpen()
    )
      return false;
    context.eventBus.emit(
      'OBJECT_SELECTED',
      {
        objectId: object.objectId,
        contentId: object.contentId,
        taskId: task.id,
      },
      'arcade',
    );
    context.answers.submit(object.contentId, object.objectId);
    // A correct answer closes the shared port; a retry leaves it open.
    return context.answers.isOpen() ? 'RETRY' : 'CORRECT';
  }

  private handleInput(event: InputEvent) {
    if (this.enabled && this.context?.state.lifecycle === 'RUNNING')
      this.context.objects.arcadeInput?.(event);
  }

  start() {
    this.enabled = true;
  }
  pause() {
    this.enabled = false;
    this.context?.objects.setArcadeActive?.(false);
  }
  resume() {
    this.enabled = true;
    if (this.context?.answers.isOpen())
      this.context?.objects.setArcadeActive?.(true);
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
