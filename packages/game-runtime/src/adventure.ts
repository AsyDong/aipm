import type {
  GameCommand,
  GameContext,
  GameDefinition,
  IAnswerPort,
  UnrecognizedReason,
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
  GameFailure,
} from '@english/game-core';
import { ContentResolver, createTasks } from '@english/learning-core';
import { pluginCatalog } from './plugin-catalog';
import { createViewport } from './viewport';
import { InputManager } from './input';
import { createMouseAdapter, createTouchAdapter } from './pointer-adapters';
import { AudioManager } from './audio';
import { validateAdventure } from './validate-adventure';
import {
  HttpSpeechRecognizer,
  SpeechService,
  VoiceRecorder,
} from '@english/speech-core';
import { VoiceCapture } from './voice-capture';

/**
 * The guide's spoken lines, by the state they belong to. Optional: a missing
 * file is skipped and the on-screen line still says it. Files come from
 * apps/web/src/data/guide.json via scripts/generate-prompts.py.
 */
const GUIDE_AUDIO = {
  hello: '/audio/guide/hello.mp3',
  right: '/audio/guide/right.mp3',
  wrong: '/audio/guide/wrong.mp3',
  hint: '/audio/guide/hint.mp3',
  notHeard: '/audio/guide/not_heard.mp3',
  done: '/audio/guide/done.mp3',
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
  const voice =
    definition.mechanic.id === 'voice-match'
      ? new VoiceCapture(
          new VoiceRecorder(),
          new SpeechService(new HttpSpeechRecognizer()),
          input,
          audio,
          (value) => {
            state.voice = value;
            publish();
          },
        )
      : undefined;
  if (voice) state.voice = { status: 'IDLE' };
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
        code: cause instanceof GameFailure ? cause.code : 'RUNTIME_ERROR',
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
    voice?.cancel();
    const token = ++revision;
    const generation = epoch;
    sayChain++;
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
  /** A spoken guide line. It never blocks play and gives way to the next sound. */
  function say(key: string) {
    void audio.say(key);
  }
  let pendingTasks: LearningTask[] = [];
  /** Bumped whenever something else takes the speaker, cancelling a pending "Yes! It is ..." chain. */
  let sayChain = 0;
  function showRound() {
    if (!runner) return;
    state.round = runner.round;
    state.feedback = 'LISTEN';
    delete state.word;
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
    say(GUIDE_AUDIO.done);
    publish();
  }
  /** Every mechanic reports answers here; the runtime decides when they count. */
  const answers: IAnswerPort = {
    isOpen: () => !locked && engine?.getState() === 'RUNNING',
    submit(contentId, objectId) {
      if (!answers.isOpen() || !context || !runner) return;
      const result = runner.submit(contentId);
      if (objectId)
        context.objects.feedback(
          objectId,
          result.correct ? 'CORRECT' : 'RETRY',
        );
      if (!result.correct) {
        state.feedback = 'RETRY';
        say(GUIDE_AUDIO.wrong);
        publish();
        return;
      }
      locked = true;
      input.disable();
      state.feedback = 'CORRECT';
      const word = runner.current()?.target.text;
      if (word) state.word = word;
      // "Yes! It is" ... then the word itself, so the child hears the whole sentence.
      // The chain belongs to this answer only: Next, pause, restart or leaving drop it,
      // otherwise the word would cut off the next prompt on a single-player device.
      const mine = ++sayChain;
      void audio.say(GUIDE_AUDIO.right).then(() => {
        const target = runner?.current()?.target.assets.audio;
        if (mine === sayChain && target && !disposed) void audio.say(target);
      });
      publish();
      // Next is deliberate: children control the listening pace and feedback cannot race pauses.
    },
    /** "Not heard" is never a wrong answer: nothing is counted and nothing is lost. */
    unrecognized(reason: UnrecognizedReason) {
      if (!answers.isOpen() || !runner) return;
      runner.unrecognized(reason);
      state.feedback = 'NOT_HEARD';
      say(GUIDE_AUDIO.notHeard);
      publish();
    },
  };
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
            assets: Object.values(GUIDE_AUDIO).map((url) => ({
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
      for (const registration of pluginCatalog(scene))
        manager.register(registration);
      const validation = manager.validate(definition);
      if (!validation.valid)
        throw new GameFailure(
          'CONFIG_INVALID',
          'runtime',
          validation.errors.join('; '),
        );
      for (const spec of [definition.scene, definition.mechanic]) {
        const extra = manager.get(spec.id)?.assets?.(spec.config) ?? [];
        if (extra.length)
          await viewport.preload(
            { scope: `plugin:${spec.id}`, assets: extra },
            scene,
          );
      }
      if (disposed) return;
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
          answers,
          content: resolver,
          rules,
          rewards,
          logger: { error: console.error },
        };
        return {
          context,
          dispose: () => {
            voice?.cancel();
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
        sayChain++;
        voice?.cancel();
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
        sayChain++;
        if (runner?.next()) showRound();
        else finish();
        break;
      case 'HINT': {
        if (!context || locked || engine.getState() !== 'RUNNING') return;
        voice?.cancel();
        const target = runner?.hint();
        if (!target) return;
        const object = context.objects.findByContent(target);
        if (object) context.objects.feedback(object.objectId, 'HINT');
        state.feedback = 'HINT';
        say(GUIDE_AUDIO.hint);
        publish();
        break;
      }
      case 'RESTART':
        epoch++;
        revision++;
        sayChain++;
        voice?.cancel();
        audio.stopAll();
        locked = true;
        await engine.restart();
        startedAt = Date.now();
        begin();
        break;
      case 'SET_VOLUME':
        audio.setVolume(command.value);
        break;
      case 'VOICE_START': {
        const task = runner?.current();
        if (voice && task && context && answers.isOpen()) {
          sayChain++;
          voice.start({ taskId: task.id, sessionId: context.sessionId });
        }
        break;
      }
      case 'VOICE_STOP':
        voice?.stop();
        break;
      case 'SAY':
        // Same-origin urls only; AssetManager enforces that on load.
        if (command.url.startsWith('/audio/guide/')) {
          await viewport.assets
            .preload({
              scope: 'cues',
              assets: [
                {
                  key: command.url,
                  type: 'AUDIO' as const,
                  url: command.url,
                  version: '1.0.0',
                },
              ],
            })
            .catch(() => {});
          if (command.wait) await audio.say(command.url);
          else say(command.url);
        }
        break;
      case 'DESTROY':
        destroy();
        break;
    }
  }
  function destroy() {
    if (disposed) return;
    disposed = true;
    voice?.cancel();
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
        ['START', 'REPLAY', 'RESUME', 'RESTART', 'NEXT', 'SAY'].includes(
          command.type,
        )
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
