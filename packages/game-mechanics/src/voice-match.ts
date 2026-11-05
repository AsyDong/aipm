import type {
  GameContext,
  IMechanicPlugin,
  InputEvent,
  PluginMetadata,
} from '@english/contracts';

export const voiceMatchMetadata: PluginMetadata = {
  id: 'voice-match',
  name: 'Listen & Say',
  version: '1.0.0',
  apiVersion: '1.0.0',
  type: 'MECHANIC',
  requiredCapabilities: ['OBJECTS'],
  capabilities: ['VOICE'],
  configSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {},
  },
};

export class VoiceMatchMechanic implements IMechanicPlugin {
  private context: GameContext | undefined;
  private offs: (() => void)[] = [];
  private enabled = false;
  initialize(context: GameContext) {
    this.context = context;
    this.offs.push(
      context.input.subscribe((event) => this.handleInput(event)),
      context.eventBus.on('TASK_PRESENTED', () => {
        const task = context.tasks.current();
        if (task)
          context.objects.show([
            {
              objectId: `${task.id}:voice`,
              contentId: task.target.id,
              image: task.target.assets.image,
            },
          ]);
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
  private handleInput(event: InputEvent) {
    const context = this.context;
    const task = context?.tasks.current();
    if (
      event.type !== 'VOICE' ||
      !this.enabled ||
      !context ||
      !task ||
      context.state.lifecycle !== 'RUNNING' ||
      !context.answers.isOpen() ||
      event.taskId !== task.id ||
      event.sessionId !== context.sessionId
    )
      return;
    context.eventBus.emit(
      'INPUT_RECEIVED',
      { inputType: 'VOICE', source: 'VOICE' },
      'voice-match',
    );
    if (event.failure) {
      context.answers.unrecognized(event.failure);
      return;
    }
    if (event.confidence !== undefined && event.confidence < 0.5) {
      context.answers.unrecognized('LOW_CONFIDENCE');
      return;
    }
    const text = event.text?.trim().toLowerCase();
    if (!text) {
      context.answers.unrecognized('NO_SPEECH');
      return;
    }
    const match = task.candidates.find(
      (candidate) => candidate.text.trim().toLowerCase() === text,
    );
    // The runtime evaluates correctness; an unknown word must not become a content ID.
    context.answers.submit(
      match?.id ?? '',
      context.objects.findByContent(match?.id ?? task.target.id)?.objectId,
    );
  }
  destroy() {
    this.enabled = false;
    this.offs.splice(0).forEach((off) => off());
    this.context = undefined;
  }
}
