import type {
  GameCommand,
  GameContext,
  GameDefinition,
  GameMessage,
  GameViewState,
  IGameBridge,
  LearningContent,
  LearningTask,
} from '@english/contracts';
import {
  GameEngine,
  PluginManager,
  RuleEngine,
  RewardManager,
  TaskRunner,
} from '@english/game-core';
import { ContentResolver, createTasks } from '@english/learning-core';
import { TapMechanic, tapMetadata } from '@english/game-mechanics';
import { FruitWorldScene, fruitWorldMetadata } from '@english/game-scenes';
import { createViewport } from './viewport';
import { InputManager } from './input';
import { createMouseAdapter, createTouchAdapter } from './pointer-adapters';
import { AudioManager } from './audio';
import { validateAdventure } from './validate-adventure';

/** Short spoken cues; optional, so a missing cue never blocks the game. */
const FEEDBACK = {
  success: '/audio/success.mp3',
  again: '/audio/again.mp3',
  complete: '/audio/complete.mp3',
};

export function createAdventure(
  parent: HTMLElement,
  definition: GameDefinition,
  contents: LearningContent[],
): IGameBridge {
  const subscribers = new Set<(message: GameMessage) => void>();
  const viewport = createViewport(parent);
  const input = new InputManager();
  const audio = new AudioManager(viewport.assets);
  const rules = new RuleEngine();
  const rewards = new RewardManager();
  const resolver = new ContentResolver(contents);
  let disposed = false;
  let engine: GameEngine | undefined;
  let context: GameContext | undefined;
  let runner: TaskRunner | undefined;
  let locked = true;
  let epoch = 0;
  let startedAt = 0;
  let revision = 0;
  let serial = Promise.resolve();
  const state: GameViewState = {
    lifecycle: 'INITIALIZING',
    round: 0,
    total: definition.rules.rounds ?? 5,
    stars: 0,
    feedback: 'LISTEN',
    busy: true,
  };
  function publish() {
    if (disposed) return;
    state.lifecycle = engine?.getState() ?? state.lifecycle;
    state.stars = rewards.getSummary().stars;
    for (const handler of subscribers)
      handler({ type: 'STATE_CHANGED', state: { ...state } });
  }
  function error(cause: unknown) {
    if (disposed) return;
    for (const handler of subscribers)
      handler({
        type: 'ERROR',
        code: 'RUNTIME_ERROR',
        message:
          cause instanceof Error ? cause.message : 'Unable to load adventure',
      });
  }
  function allowInput() {
    if (engine?.getState() === 'RUNNING' && !locked)
      input.enable(definition.input.allowed);
    else input.disable();
  }
  async function playPrompt(replay: boolean) {
    const task = runner?.current();
    if (!task || disposed || !context || engine?.getState() !== 'RUNNING')
      return;
    const token = ++revision;
    const generation = epoch;
    locked = true;
    state.busy = true;
    input.disable();
    state.feedback = 'LISTEN';
    publish();
    try {
      await audio.play(task.target.assets.audio);
      if (
        token !== revision ||
        generation !== epoch ||
        disposed ||
        engine.getState() !== 'RUNNING'
      )
        return;
      context.eventBus.emit(
        'AUDIO_PLAYED',
        {
          taskId: task.id,
          contentId: task.target.id,
          audioType: replay ? 'REPLAY' : 'PROMPT',
        },
        'audio',
      );
      if (replay) runner?.replayed();
      locked = false;
    } catch {
      if (token !== revision || generation !== epoch || disposed) return;
      state.feedback = 'AUDIO_ERROR';
      locked = true;
    } finally {
      if (token === revision && generation === epoch && !disposed) {
        state.busy = false;
        allowInput();
        publish();
      }
    }
  }
  /** Short feedback cues never block play; a failed cue is simply skipped. */
  function cue(key: string) {
    void audio.play(key).catch(() => {});
  }
  let pendingTasks: LearningTask[] = [];
  function showRound() {
    if (!runner) return;
    state.round = runner.round;
    state.feedback = 'LISTEN';
    void playPrompt(false);
  }
  /** First round of a session: the engine is already started, so plugins listen. */
  function begin() {
    runner?.start(pendingTasks);
    showRound();
  }
  function finish() {
    if (!engine || !context || !runner) return;
    locked = true;
    input.disable();
    const summary = runner.finish(Date.now() - startedAt);
    state.summary = summary;
    state.busy = false;
    engine.complete(summary.durationMs);
    context.eventBus.emit(
      'GAME_REWARD_SUMMARY',
      { stars: summary.stars, collectibles: 0 },
      'rewards',
    );
    cue(FEEDBACK.complete);
    publish();
  }
  function answer(objectId: string, contentId: string, taskId: string) {
    if (
      locked ||
      !context ||
      !runner ||
      !engine ||
      engine.getState() !== 'RUNNING' ||
      runner.current()?.id !== taskId
    )
      return;
    const result = runner.submit(contentId);
    context.objects.feedback(objectId, result.correct ? 'CORRECT' : 'RETRY');
    if (!result.correct) {
      state.feedback = 'RETRY';
      cue(FEEDBACK.again);
      publish();
      return;
    }
    locked = true;
    input.disable();
    state.feedback = 'CORRECT';
    cue(FEEDBACK.success);
    publish();
    // Next is deliberate: children control the listening pace and feedback cannot race pauses.
  }
  const ready = viewport.ready
    .then(async ({ scene, objects }) => {
      if (disposed) return;
      validateAdventure(definition);
      const resolved = await resolver.resolve(definition.content);
      const assets = resolved.flatMap((content) => [
        {
          key: content.assets.image,
          type: 'IMAGE' as const,
          url: content.assets.image,
          version: '1.0.0',
        },
        {
          key: content.assets.audio,
          type: 'AUDIO' as const,
          url: content.assets.audio,
          version: '1.0.0',
        },
      ]);
      await viewport.preload({ scope: 'session', assets }, scene);
      if (disposed) return;
      await viewport
        .preload(
          {
            scope: 'cues',
            assets: Object.values(FEEDBACK).map((url) => ({
              key: url,
              type: 'AUDIO' as const,
              url,
              version: '1.0.0',
            })),
          },
          scene,
        )
        .catch(() => {});
      if (disposed) return;
      const manager = new PluginManager();
      manager.register({
        metadata: fruitWorldMetadata,
        create: () => new FruitWorldScene(scene),
      });
      manager.register({
        metadata: tapMetadata,
        create: () => new TapMechanic(),
      });
      engine = new GameEngine(manager, (base) => {
        rules.initialize(definition.rules);
        rewards.reset();
        pendingTasks = createTasks(
          resolved,
          definition.rules.rounds ?? resolved.length,
          definition.difficulty?.optionCount ?? 3,
          Math.random,
          definition.rules.progression?.mode ?? 'SEQUENTIAL',
        );
        runner = new TaskRunner(
          base.eventBus,
          rules,
          rewards,
          definition,
          base.sessionId,
        );
        delete state.summary;
        context = {
          ...base,
          input,
          audio,
          assets: viewport.assets,
          objects,
          tasks: runner,
          content: resolver,
          rules,
          rewards,
          logger: { error: console.error },
        };
        const off = base.eventBus.on('OBJECT_SELECTED', (event) =>
          answer(
            event.payload.objectId,
            event.payload.contentId,
            event.payload.taskId,
          ),
        );
        return {
          context,
          dispose: () => {
            off();
            input.disable();
            audio.stopAll();
            objects.clear();
          },
        };
      });
      input.registerAdapter(createTouchAdapter(scene));
      input.registerAdapter(createMouseAdapter(scene));
      await engine.initialize(definition);
      if (disposed) {
        await engine.destroy();
        return;
      }
      state.busy = false;
      publish();
    })
    .catch(error);

  async function execute(command: GameCommand) {
    await ready;
    if (disposed || !engine) return;
    switch (command.type) {
      case 'START':
        if (engine.getState() !== 'READY') return;
        startedAt = Date.now();
        await engine.start();
        begin();
        break;
      case 'PAUSE':
        if (engine.getState() !== 'RUNNING') return;
        revision++;
        audio.stopAll();
        input.disable();
        state.busy = false;
        engine.pause();
        publish();
        break;
      case 'RESUME':
        if (engine.getState() !== 'PAUSED') return;
        engine.resume();
        publish();
        if (state.feedback !== 'CORRECT') void playPrompt(true);
        break;
      case 'REPLAY':
        if (state.feedback !== 'CORRECT') void playPrompt(true);
        break;
      case 'NEXT':
        if (engine.getState() !== 'RUNNING' || state.feedback !== 'CORRECT')
          return;
        if (runner?.next()) showRound();
        else finish();
        break;
      case 'HINT': {
        if (!context || locked || engine.getState() !== 'RUNNING') return;
        const target = runner?.hint();
        if (!target) return;
        const object = context.objects.findByContent(target);
        if (object) context.objects.feedback(object.objectId, 'HINT');
        state.feedback = 'HINT';
        publish();
        break;
      }
      case 'RESTART':
        epoch++;
        revision++;
        audio.stopAll();
        locked = true;
        await engine.restart();
        startedAt = Date.now();
        begin();
        break;
      case 'SET_VOLUME':
        audio.setVolume(command.value);
        break;
      case 'DESTROY':
        destroy();
        break;
    }
  }
  function destroy() {
    if (disposed) return;
    disposed = true;
    epoch++;
    revision++;
    subscribers.clear();
    input.destroy();
    void audio.destroy();
    void (engine?.destroy() ?? Promise.resolve()).finally(() =>
      viewport.destroy(),
    );
  }
  return {
    send(command) {
      if (disposed) return;
      if (
        ['START', 'REPLAY', 'RESUME', 'RESTART', 'NEXT'].includes(command.type)
      )
        audio.unlock();
      serial = serial.then(() => execute(command)).catch(error);
    },
    subscribe(handler) {
      subscribers.add(handler);
      handler({ type: 'STATE_CHANGED', state: { ...state } });
      return () => {
        subscribers.delete(handler);
      };
    },
    destroy,
  };
}
