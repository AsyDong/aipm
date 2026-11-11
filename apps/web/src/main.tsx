import { lazy, Suspense, StrictMode, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import type {
  GameViewState,
  IGameBridge,
  LearningOptions,
  LearningProgress,
  GameDefinition,
} from '@english/contracts';
import { learnerId, LearningOutbox } from './learning';
const Composer = lazy(() =>
  import('./composer').then(({ Composer }) => ({ default: Composer })),
);
import { mountAdventure } from '@english/runtime';
import {
  allContent,
  definitionFor,
  guideAudio,
  guideText,
  world,
  nextStoryLevel,
  type GuideKey,
  type WorldLevel,
  type WorldUnit,
} from './content';
import { gameStars, loadStars, saveStars } from './progress';
import {
  BackIcon,
  BulbIcon,
  MutedIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  SpeakerIcon,
  StarIcon,
} from './icons';
import { tryLockLandscape, usePortraitPhone } from './orientation';
import './style.css';

/** World overview art; units without their own map zoom into this. */
const WORLD_MAP_SRC = '/images/maps/world.webp';

const INITIAL: GameViewState = {
  lifecycle: 'INITIALIZING',
  round: 0,
  total: 5,
  stars: 0,
  feedback: 'LISTEN',
  busy: true,
};

function Stars({ count, of = 3 }: { count: number; of?: number }) {
  return (
    <span className="star-row" aria-label={`${count} of ${of} stars`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={i < count ? 'on' : ''}>
          <StarIcon />
        </span>
      ))}
    </span>
  );
}

/** Speech bubble beside the monkey guide; the monkey is the voice of the story. */
function Guide({ children }: { children: ReactNode }) {
  return (
    <div className="guide" role="status" aria-live="polite">
      <img src="/images/mascot.webp" alt="" className="guide-monkey" />
      <p className="bubble">{children}</p>
    </div>
  );
}

/** Which guide line fits the game right now; the words live in data/guide.json. */
function guideKey(state: GameViewState, hasError: boolean): GuideKey {
  if (hasError) return 'AUDIO_ERROR';
  if (state.lifecycle === 'PAUSED') return 'BREAK';
  if (state.lifecycle === 'READY') return 'HELLO';
  if (state.lifecycle === 'COMPLETED') return 'DONE';
  switch (state.feedback) {
    case 'AUDIO_ERROR':
      return 'AUDIO_ERROR';
    case 'NOT_HEARD':
      return 'NOT_HEARD';
    case 'CORRECT':
      return 'RIGHT';
    case 'RETRY':
      return 'WRONG';
    case 'HINT':
      return 'HINT';
    default:
      return state.busy ? 'LISTEN' : 'ASK';
  }
}

function Level({
  level,
  onExit,
  onDone,
  learning,
  definition,
  onNext,
}: {
  level: WorldLevel;
  onExit: () => void;
  onDone: (stars: number) => void;
  learning?: LearningOptions | undefined;
  definition?: GameDefinition;
  onNext?: (() => void) | undefined;
}) {
  const host = useRef<HTMLDivElement>(null);
  const bridge = useRef<IGameBridge | null>(null);
  const [state, setState] = useState<GameViewState>(INITIAL);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const saved = useRef(false);
  useEffect(() => {
    if (!host.current || (!level.game && !definition)) return;
    const game = mountAdventure(
      host.current,
      definition ?? definitionFor(level.game!),
      allContent,
      learning,
    );
    bridge.current = game;
    const off = game.subscribe((message) => {
      if (message.type === 'ERROR') setError(message.message);
      else setState(message.state);
    });
    const hide = () => {
      if (document.hidden) game.send({ type: 'PAUSE' });
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      off();
      game.destroy();
      bridge.current = null;
      document.removeEventListener('visibilitychange', hide);
    };
  }, [level.game, learning, definition]);
  const send = (command: Parameters<IGameBridge['send']>[0]) =>
    bridge.current?.send(command);
  const ready = state.lifecycle === 'READY';
  const active = state.lifecycle === 'RUNNING';
  const paused = state.lifecycle === 'PAUSED';
  const completed = state.lifecycle === 'COMPLETED';
  const correct = state.feedback === 'CORRECT';
  const slicing =
    (definition ?? (level.game ? definitionFor(level.game) : undefined))
      ?.mechanic.id === 'slice';
  const voiceBusy = !!state.voice && state.voice.status !== 'IDLE';
  const voiceMessages = {
    NO_SPEECH: 'I did not hear a word. Tap Record to try again.',
    LOW_CONFIDENCE: 'Let’s try that word again. Tap Record.',
    TIMEOUT: 'That took too long. Tap Record to try again.',
    PERMISSION_DENIED:
      'Ask a grown-up to allow the microphone, then try again.',
    UNSUPPORTED:
      'The microphone is not available here. Ask a grown-up for help.',
    ERROR: 'I could not hear you this time. Tap Record to try again.',
  };
  const voiceLine =
    state.voice?.status === 'REQUESTING'
      ? 'Allow the microphone to say the word.'
      : state.voice?.status === 'RECORDING'
        ? 'Say the word! Tap Done when you finish.'
        : state.voice?.status === 'RECOGNIZING'
          ? 'Let me listen…'
          : state.voice?.failure
            ? voiceMessages[state.voice.failure]
            : state.voice &&
                !state.busy &&
                !correct &&
                state.feedback === 'LISTEN'
              ? 'Tap Record and say the word!'
              : undefined;
  const sliceLine =
    slicing && !state.busy && !correct
      ? state.feedback === 'RETRY'
        ? 'Try another fruit. Swipe to slice!'
        : state.feedback === 'LISTEN'
          ? 'Swipe across the fruit you heard!'
          : undefined
      : undefined;
  const portrait = usePortraitPhone();
  // Turning the phone upright pauses the game instead of hiding it behind a notice.
  useEffect(() => {
    if (portrait && active) bridge.current?.send({ type: 'PAUSE' });
  }, [portrait, active]);
  const gameDefinition = definition ?? definitionFor(level.game!);
  const earned = gameStars(state.stars, gameDefinition);
  const spoken = useRef('');
  useEffect(() => {
    const key = guideKey(state, !!error);
    if (key !== 'BREAK') {
      spoken.current = '';
      return;
    }
    if (spoken.current === key) return; // once per visit to that state
    spoken.current = key;
    const url = guideAudio(key, level);
    if (url) bridge.current?.send({ type: 'SAY', url });
  }, [state, error, level]);
  useEffect(() => {
    if (completed && !saved.current) {
      saved.current = true;
      onDone(state.stars);
    }
    if (!completed) saved.current = false;
  }, [completed, state.stars, onDone]);

  return (
    <section className="level" aria-label={`${level.title} level`}>
      <div className="hud">
        <button
          className="round-btn"
          aria-label="Back to the map"
          onClick={onExit}
        >
          <BackIcon />
        </button>
        <div
          className="journey"
          aria-label={`Round ${state.round} of ${state.total}`}
        >
          {Array.from({ length: state.total }, (_, i) => (
            <span
              key={i}
              className={
                i < state.round - (correct ? 0 : 1)
                  ? 'done'
                  : i === state.round - 1
                    ? 'current'
                    : ''
              }
            />
          ))}
        </div>
        <span className="star-counter" aria-label={`${state.stars} stars`}>
          <StarIcon /> <strong>{state.stars}</strong>
        </span>
      </div>
      <div className="stage">
        {level.collection && active && (
          <div className="task-collection" aria-label={level.collection}>
            <span>
              {level.collection} · {state.collected?.length ?? 0}/{state.total}
            </span>
            <div>
              {state.collected?.map((item) => (
                <img key={item.taskId} src={item.image} alt={item.text} />
              ))}
            </div>
          </div>
        )}
        <div
          className="canvas-host"
          ref={host}
          data-testid="game-host"
          aria-label={
            state.voice
              ? 'Fruit on the counter. Listen, then record your voice.'
              : slicing
                ? 'Fruit on the counter. Listen, then swipe across one.'
                : 'Fruit on the counter. Listen, then tap one.'
          }
        />
        <Guide>
          {active && (voiceLine || sliceLine)
            ? voiceLine || sliceLine
            : guideText(guideKey(state, !!error), state.word, level)}
        </Guide>
        {(ready ||
          paused ||
          completed ||
          !!error ||
          state.lifecycle === 'INITIALIZING') && (
          <div className={`overlay ${completed ? 'results' : ''}`}>
            {error ? (
              <>
                <h2>Let’s try that again.</h2>
                <p className="error-detail">{error}</p>
                <button className="big-btn" onClick={onExit}>
                  <BackIcon /> Back to the map
                </button>
              </>
            ) : completed ? (
              <>
                <h2>Great job!</h2>
                {level.outcome && <p className="story">{level.outcome}</p>}
                {level.collection && (
                  <div
                    className={`story-result ${level.id === 'picnic-time' ? 'picnic-result' : ''}`}
                    aria-label={`${level.collection} complete`}
                  >
                    {level.id === 'picnic-time' && (
                      <div className="picnic-friends">
                        {['jim', 'jenny', 'cameron'].map((name) => (
                          <img
                            key={name}
                            src={`/images/characters/${name}.webp`}
                            alt={name}
                          />
                        ))}
                      </div>
                    )}
                    <div className="collected-items">
                      {state.collected?.map((item) => (
                        <img
                          key={item.taskId}
                          src={item.image}
                          alt={item.text}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <Stars count={earned} />
                <p>
                  You collected <strong>{state.stars}</strong> stars.
                </p>
                <div className="overlay-actions">
                  {onNext && (
                    <button className="big-btn" onClick={onNext}>
                      Continue adventure <NextIcon />
                    </button>
                  )}
                  <button
                    className="big-btn"
                    onClick={() => {
                      setMuted(false);
                      send({ type: 'SET_VOLUME', value: 1 });
                      send({ type: 'RESTART' });
                    }}
                  >
                    <PlayIcon /> Play again
                  </button>
                  <button className="big-btn alt" onClick={onExit}>
                    Back to the map
                  </button>
                </div>
                {state.summary && (
                  <details className="session-notes">
                    <summary>Grown-up notes</summary>
                    <p>
                      First choices: {state.summary.firstTryCorrect} /{' '}
                      {state.summary.total} · Replays: {state.summary.replays} ·
                      Hints: {state.summary.hints}
                    </p>
                    <p>
                      These observations help plan another listen. They are not
                      a measure of vocabulary mastery.
                    </p>
                  </details>
                )}
              </>
            ) : paused ? (
              <>
                <h2>Break time</h2>
                <button
                  className="big-btn"
                  onClick={() => send({ type: 'RESUME' })}
                >
                  <PlayIcon /> Keep playing
                </button>
              </>
            ) : ready ? (
              <>
                <h2>{level.title}</h2>
                {level.story && <p className="story">{level.story}</p>}
                <p>
                  {state.voice
                    ? 'Listen to the word. Tap Record and say it. Your voice is sent for recognition and is not saved on this device.'
                    : slicing
                      ? 'Listen to the word. Swipe across the fruit.'
                      : 'Listen to the word. Tap the right one.'}
                </p>
                <button
                  className="big-btn"
                  onClick={() => {
                    const url = guideAudio('HELLO', level);
                    if (url) send({ type: 'SAY', url, wait: true });
                    send({ type: 'START' });
                  }}
                >
                  <PlayIcon /> Let’s play
                </button>
              </>
            ) : (
              <>
                <span className="spinner" />
                <p>Getting ready…</p>
              </>
            )}
          </div>
        )}
      </div>
      <div className="controls">
        {active && (
          <>
            <button
              className="round-btn"
              aria-label={muted ? 'Unmute' : 'Mute'}
              onClick={() => {
                send({ type: 'SET_VOLUME', value: muted ? 1 : 0 });
                setMuted(!muted);
              }}
            >
              {muted ? <MutedIcon /> : <SpeakerIcon />}
            </button>
            <button
              className="big-btn alt"
              disabled={state.busy || correct || voiceBusy}
              onClick={() => send({ type: 'HINT' })}
            >
              <BulbIcon /> Hint
            </button>
            {state.voice && !correct && (
              <button
                className="big-btn"
                disabled={
                  state.busy ||
                  state.voice.status === 'REQUESTING' ||
                  state.voice.status === 'RECOGNIZING'
                }
                onClick={() =>
                  send({
                    type:
                      state.voice?.status === 'RECORDING'
                        ? 'VOICE_STOP'
                        : 'VOICE_START',
                  })
                }
              >
                {state.voice.status === 'RECORDING' ? 'Done' : 'Record'}
              </button>
            )}
            {correct ? (
              <button
                className="big-btn nudge"
                onClick={() => send({ type: 'NEXT' })}
              >
                {state.round === state.total ? 'Finish' : 'Next'} <NextIcon />
              </button>
            ) : (
              <button
                className="big-btn"
                disabled={state.busy || voiceBusy}
                onClick={() => send({ type: 'REPLAY' })}
              >
                <SpeakerIcon /> Listen
              </button>
            )}
            <button
              className="round-btn"
              aria-label="Pause"
              onClick={() => send({ type: 'PAUSE' })}
            >
              <PauseIcon />
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function WorldMap({ onPickUnit }: { onPickUnit: (unit: WorldUnit) => void }) {
  return (
    <section className="world" aria-label={world.title}>
      <div className="chapter-heading">
        <div>
          <h1>World map</h1>
          <p>U0–U9 · Follow the friends from the harbour to the farm</p>
        </div>
      </div>
      <div className="world-map">
        <div className="map-art">
          <img src={WORLD_MAP_SRC} alt="" className="world-art" />
          {world.units.map((unit) => {
            return (
              <div
                key={unit.id}
                className="pin unit-pin"
                style={{ left: `${unit.x}%`, top: `${unit.y}%` }}
              >
                <button
                  aria-label={`Open ${unit.title}`}
                  onClick={() => onPickUnit(unit)}
                  title={unit.title}
                >
                  <span className="pin-bubble">{unit.marker}</span>
                </button>
                <span className="pin-label">{unit.title}</span>
              </div>
            );
          })}
        </div>
      </div>
      <p className="map-key">U0–U9 · Open a unit to see its story locations</p>
    </section>
  );
}

function UnitMap({
  unit,
  stars,
  onPick,
  onBack,
}: {
  unit: WorldUnit;
  stars: Record<string, number>;
  onPick: (level: WorldLevel) => void;
  onBack: () => void;
}) {
  const levels = world.levels.filter((level) => level.unitId === unit.id);
  return (
    <section className="world" aria-label={`${unit.title} map`}>
      <div className="chapter-heading">
        <div>
          <h1>{unit.title}</h1>
          <p>Unit map · {unit.subtitle}</p>
        </div>
        <button className="big-btn" onClick={onBack}>
          World map
        </button>
      </div>
      <div className="world-map unit-map">
        <div className="map-art">
          <img src={unit.map ?? WORLD_MAP_SRC} alt="" className="world-art" />
          {levels.map((level) => {
            const got = level.game
              ? gameStars(stars[level.id] ?? 0, definitionFor(level.game))
              : 0;
            return (
              <div
                key={level.id}
                className={`pin ${got ? 'cleared' : ''}`}
                style={{ left: `${level.x}%`, top: `${level.y}%` }}
              >
                <button
                  aria-label={`Play ${level.title}`}
                  onClick={() => onPick(level)}
                >
                  <span className="pin-bubble">{level.marker}</span>
                </button>
                <span className="pin-label">{level.title}</span>
                <Stars count={got} />
              </div>
            );
          })}
        </div>
      </div>
      <p className="map-key">
        {levels.length
          ? `${levels.length} story locations · Choose a numbered point`
          : 'This unit is being prepared'}
      </p>
    </section>
  );
}

function RotateNotice() {
  return (
    <div className="rotate" role="alert">
      <img src="/images/mascot.webp" alt="" />
      <span className="rotate-phone" aria-hidden="true" />
      <p>Turn your phone sideways to play!</p>
    </div>
  );
}

function App() {
  const [composing, setComposing] = useState(false);
  const [preview, setPreview] = useState<GameDefinition>();
  const [level, setLevel] = useState<WorldLevel | null>(null);
  const [unit, setUnit] = useState<WorldUnit | null>(null);
  const [stars, setStars] = useState(loadStars);
  const portrait = usePortraitPhone();
  const [learning, setLearning] = useState<LearningOptions>();
  const [syncNote, setSyncNote] = useState('');
  const [observations, setObservations] = useState<LearningProgress[]>([]);
  useEffect(() => {
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let syncing = false;
    let storageFailed = false;
    let delay = 15000;
    try {
      const id = learnerId();
      const outbox = new LearningOutbox(localStorage);
      const sync = async () => {
        if (syncing || !active) return;
        syncing = true;
        clearTimeout(retry);
        try {
          await outbox.flush();
          const response = await fetch(
            `/api/v1/learning-progress?learnerId=${encodeURIComponent(id)}`,
            { signal: AbortSignal.timeout(8000) },
          );
          if (!response.ok) throw new Error('Learning sync unavailable');
          const data = (await response.json()) as {
            progress: LearningProgress[];
          };
          if (!Array.isArray(data.progress))
            throw new Error('Invalid learning progress');
          if (active) {
            setObservations(data.progress);
            if (!storageFailed)
              setSyncNote(
                outbox.pending().length
                  ? 'Learning notes saved on this device. Sync pending.'
                  : 'Learning notes synced.',
              );
          }
          delay = 15000;
        } catch {
          if (active && !storageFailed)
            setSyncNote('Learning notes saved on this device. Sync pending.');
          delay = Math.min(delay * 2, 300000);
        } finally {
          syncing = false;
          if (active)
            retry = setTimeout(() => {
              void sync();
            }, delay);
        }
      };
      setLearning({
        learnerId: id,
        save: (submission) => {
          try {
            outbox.save(submission);
            storageFailed = false;
            if (active)
              setSyncNote('Learning notes saved on this device. Sync pending.');
            void sync();
          } catch {
            storageFailed = true;
            if (active)
              setSyncNote(
                'Learning notes could not be saved. Device storage is unavailable or full.',
              );
          }
        },
      });
      const online = () => {
        void sync();
      };
      window.addEventListener('online', online);
      void sync();
      return () => {
        active = false;
        clearTimeout(retry);
        window.removeEventListener('online', online);
      };
    } catch {
      setSyncNote(
        'Learning notes are unavailable because device storage is blocked.',
      );
    }
    return () => {
      active = false;
    };
  }, []);
  const pick = (next: WorldLevel) => {
    void tryLockLandscape();
    setLevel(next);
  };
  const pickUnit = (next: WorldUnit) => {
    void tryLockLandscape();
    setUnit(next);
  };
  return (
    <main>
      {portrait && <RotateNotice />}
      <header>
        <span className="brand">
          <img src="/images/mascot.webp" alt="" />
          English Adventure
        </span>
        <span className="subtitle">{level ? level.subtitle : world.title}</span>
      </header>
      {composing ? (
        preview ? (
          <Level
            key={preview.id}
            level={{ id: preview.id, title: preview.name, x: 0, y: 0 }}
            definition={preview}
            onExit={() => setPreview(undefined)}
            onDone={() => {}}
          />
        ) : (
          <Suspense fallback={<p role="status">Loading Game Composer…</p>}>
            <Composer
              onPreview={setPreview}
              onExit={() => setComposing(false)}
            />
          </Suspense>
        )
      ) : level ? (
        <Level
          key={level.id}
          level={level}
          onExit={() => setLevel(null)}
          onDone={(earned) => setStars(saveStars(level.id, earned))}
          learning={learning}
          onNext={
            nextStoryLevel(level)
              ? () => pick(nextStoryLevel(level)!)
              : undefined
          }
        />
      ) : unit ? (
        <UnitMap
          unit={unit}
          stars={stars}
          onPick={pick}
          onBack={() => setUnit(null)}
        />
      ) : (
        <WorldMap onPickUnit={pickUnit} />
      )}
      {!level && !composing && (
        <details className="session-notes">
          <summary>Learning notes for grown-ups</summary>
          <p>{syncNote}</p>
          <p>
            This device uses one anonymous profile. These observations are
            separate from stars and do not measure vocabulary mastery.
          </p>
          {observations.map((item) => (
            <p key={`${item.curriculumId}:${item.unitId}:${item.contentId}`}>
              {allContent.find(
                (content) =>
                  content.id === item.contentId &&
                  content.curriculumId === item.curriculumId &&
                  content.unitId === item.unitId,
              )?.text ?? item.contentId}
              : {item.listens} listens · {item.completions} completed tasks ·{' '}
              {item.hints} hints · {item.voiceAttempts} recordings ·{' '}
              {item.recognized} recognized ·{' '}
              {item.needsReview ? 'Listen again' : 'Practised'}
            </p>
          ))}
        </details>
      )}
      {!level && !composing && (
        <button onClick={() => setComposing(true)}>
          Game Composer for grown-ups
        </button>
      )}
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
