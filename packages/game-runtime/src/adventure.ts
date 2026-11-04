import type {
  GameCommand,
  GameContext,
  GameDefinition,
  GameMessage,
  GameSummary,
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
} from '@english/game-core';
import { ContentResolver, createTasks } from '@english/learning-core';
import { TapMechanic, tapMetadata } from '@english/game-mechanics';
import { FruitWorldScene, fruitWorldMetadata } from '@english/game-scenes';
import { createViewport } from './viewport';
import { InputManager } from './input';
import { AudioManager } from './audio';
import { validateAdventure } from './validate-adventure';

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
  let mechanic: TapMechanic | undefined;
  let tasks: LearningTask[] = [];
  let index = 0;
  let locked = true;
  let epoch = 0;
  let startedAt = 0;
  let firstTryCorrect = 0;
  let replays = 0;
  let hints = 0;
  let attempts = 0;
  let hinted = false;
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
    const task = tasks[index];
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
      if (replay) replays++;
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
  function present() {
    const task = tasks[index];
    if (!task || !context || !mechanic) return;
    rules.setTask(task);
    attempts = 0;
    hinted = false;
    mechanic.present(task);
    state.round = index + 1;
    state.feedback = 'LISTEN';
    context.eventBus.emit(
      'TASK_PRESENTED',
      {
        taskId: task.id,
        contentId: task.target.id,
        curriculumId: task.curriculumId,
        unitId: task.unitId,
      },
      'learning',
    );
    void playPrompt(false);
  }
  function finish() {
    if (!engine || !context) return;
    locked = true;
    input.disable();
    const bonus = definition.reward.completionBonus ?? 0;
    if (bonus)
      rewards.grant('completion', { type: 'STAR', successReward: bonus });
    const summary: GameSummary = {
      sessionId: context.sessionId,
      completed: index,
      total: tasks.length,
      stars: rewards.getSummary().stars,
      firstTryCorrect,
      replays,
      hints,
      durationMs: Date.now() - startedAt,
    };
    state.summary = summary;
    state.busy = false;
    engine.complete(summary.durationMs);
    context.eventBus.emit(
      'GAME_REWARD_SUMMARY',
      { stars: summary.stars, collectibles: 0 },
      'rewards',
    );
    publish();
  }
  function answer(objectId: string, contentId: string, taskId: string) {
    if (
      locked ||
      !context ||
      !engine ||
      engine.getState() !== 'RUNNING' ||
      tasks[index]?.id !== taskId
    )
      return;
    context.eventBus.emit(
      'ANSWER_SUBMITTED',
      { taskId, contentId },
      'learning',
    );
    const result = rules.evaluate({ taskId, contentId });
    attempts = result.attempts;
    context.objects.feedback(objectId, result.correct ? 'CORRECT' : 'RETRY');
    context.eventBus.emit(
      result.correct ? 'ANSWER_CORRECT' : 'ANSWER_INCORRECT',
      { taskId, contentId, attempts: result.attempts },
      'rules',
    );
    if (!result.correct) {
      state.feedback = 'RETRY';
      publish();
      return;
    }
    locked = true;
    input.disable();
    state.feedback = 'CORRECT';
    if (result.attempts === 1 && !hinted) firstTryCorrect++;
    const amount = rewards.grant(taskId, definition.reward);
    context.eventBus.emit(
      'REWARD_GRANTED',
      { taskId, rewardType: definition.reward.type, amount },
      'rewards',
    );
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
      const manager = new PluginManager();
      manager.register({
        metadata: fruitWorldMetadata,
        create: () => new FruitWorldScene(scene),
      });
      manager.register({
        metadata: tapMetadata,
        create: () => {
          mechanic = new TapMechanic();
          return mechanic;
        },
      });
      engine = new GameEngine(manager, (base) => {
        rules.initialize(definition.rules);
        rewards.reset();
        tasks = createTasks(
          resolved,
          definition.rules.rounds ?? resolved.length,
          definition.difficulty?.optionCount ?? 3,
          Math.random,
          definition.rules.progression?.mode ?? 'SEQUENTIAL',
        );
        index = 0;
        firstTryCorrect = 0;
        replays = 0;
        hints = 0;
        delete state.summary;
        context = {
          ...base,
          input,
          audio,
          assets: viewport.assets,
          objects,
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
      const pointerHandler = (pointer: Phaser.Input.Pointer) => {
        if (locked || engine?.getState() !== 'RUNNING') return;
        context?.eventBus.emit(
          'INPUT_RECEIVED',
          { inputType: 'TAP', source: pointer.wasTouch ? 'TOUCH' : 'MOUSE' },
          'input',
        );
        input.dispatch({
          type: 'TAP',
          source: pointer.wasTouch ? 'TOUCH' : 'MOUSE',
          x: pointer.worldX,
          y: pointer.worldY,
          timestamp: Date.now(),
        });
      };
      scene.input.on('pointerup', pointerHandler);
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
        present();
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
        rules.nextRound();
        index++;
        if (index >= tasks.length) finish();
        else present();
        break;
      case 'HINT': {
        const task = tasks[index];
        if (
          locked ||
          !context ||
          !task ||
          engine.getState() !== 'RUNNING' ||
          !definition.rules.hintPolicy?.enabled
        )
          return;
        if (attempts < (definition.rules.hintPolicy.afterAttempts ?? 1)) return;
        const object = objectsForTarget(task);
        if (object) context.objects.feedback(object, 'HINT');
        hints++;
        hinted = true;
        state.feedback = 'HINT';
        context.eventBus.emit(
          'HINT_REQUESTED',
          { taskId: task.id, level: 1 },
          'learning',
        );
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
        present();
        break;
      case 'SET_VOLUME':
        audio.setVolume(command.value);
        break;
      case 'DESTROY':
        destroy();
        break;
    }
  }
  function objectsForTarget(task: LearningTask) {
    const i = task.candidates.findIndex(
      (content) => content.id === task.target.id,
    );
    return i < 0 ? undefined : `${task.id}:${i}`;
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
