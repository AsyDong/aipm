import { StrictMode, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import type { GameViewState, IGameBridge } from '@english/contracts';
import { mountAdventure } from '@english/runtime';
import {
  allContent,
  definitionFor,
  guideAudio,
  guideText,
  world,
  type GuideKey,
  type WorldLevel,
} from './content';
import { loadStars, mapStars, saveStars } from './progress';
import {
  BackIcon,
  BulbIcon,
  LockIcon,
  MutedIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  SpeakerIcon,
  StarIcon,
} from './icons';
import { tryLockLandscape, usePortraitPhone } from './orientation';
import './style.css';

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
}: {
  level: WorldLevel;
  onExit: () => void;
  onDone: (stars: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const bridge = useRef<IGameBridge | null>(null);
  const [state, setState] = useState<GameViewState>(INITIAL);
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  const saved = useRef(false);
  useEffect(() => {
    if (!host.current || !level.game) return;
    const game = mountAdventure(
      host.current,
      definitionFor(level.game),
      allContent,
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
  }, [level.game]);
  const send = (command: Parameters<IGameBridge['send']>[0]) =>
    bridge.current?.send(command);
  const ready = state.lifecycle === 'READY';
  const active = state.lifecycle === 'RUNNING';
  const paused = state.lifecycle === 'PAUSED';
  const completed = state.lifecycle === 'COMPLETED';
  const correct = state.feedback === 'CORRECT';
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
  const portrait = usePortraitPhone();
  // Turning the phone upright pauses the game instead of hiding it behind a notice.
  useEffect(() => {
    if (portrait && active) bridge.current?.send({ type: 'PAUSE' });
  }, [portrait, active]);
  const earned = mapStars(state.stars, state.total + 1);
  const spoken = useRef('');
  useEffect(() => {
    const key = guideKey(state, !!error);
    if (key !== 'BREAK') {
      spoken.current = '';
      return;
    }
    if (spoken.current === key) return; // once per visit to that state
    spoken.current = key;
    const url = guideAudio(key);
    if (url) bridge.current?.send({ type: 'SAY', url });
  }, [state, error]);
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
        <div
          className="canvas-host"
          ref={host}
          data-testid="game-host"
          aria-label={
            state.voice
              ? 'Fruit on the counter. Listen, then record your voice.'
              : 'Fruit on the counter. Listen, then tap one.'
          }
        />
        <Guide>
          {active && voiceLine
            ? voiceLine
            : guideText(guideKey(state, !!error), state.word)}
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
                <Stars count={earned} />
                <p>
                  You collected <strong>{state.stars}</strong> stars.
                </p>
                <div className="overlay-actions">
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
                <p>
                  {state.voice
                    ? 'Listen to the word. Tap Record and say it. Your voice is sent for recognition and is not saved on this device.'
                    : 'Listen to the word. Tap the fruit.'}
                </p>
                <button
                  className="big-btn"
                  onClick={() => {
                    const url = guideAudio('HELLO');
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

function WorldMap({
  stars,
  onPick,
}: {
  stars: Record<string, number>;
  onPick: (level: WorldLevel) => void;
}) {
  return (
    <section className="world" aria-label={world.title}>
      <div className="world-map">
        <div className="map-art">
          <img src="/images/map.webp" alt="" className="world-art" />
          {world.levels.map((level) => {
            const got = mapStars(stars[level.id] ?? 0, 6);
            return (
              <button
                key={level.id}
                className={`pin ${level.locked ? 'locked' : ''} ${got ? 'cleared' : ''}`}
                style={{ left: `${level.x}%`, top: `${level.y}%` }}
                disabled={level.locked}
                aria-label={
                  level.locked
                    ? `${level.title}, coming soon`
                    : `Play ${level.title}`
                }
                onClick={() => onPick(level)}
              >
                <span className="pin-bubble">
                  {level.locked ? <LockIcon /> : <PlayIcon />}
                </span>
                <span className="pin-label">{level.title}</span>
                {!level.locked && <Stars count={got} />}
              </button>
            );
          })}
        </div>
        <div className="map-guide">
          <Guide>{guideText('MAP')}</Guide>
        </div>
      </div>
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
  const [level, setLevel] = useState<WorldLevel | null>(null);
  const [stars, setStars] = useState(loadStars);
  const portrait = usePortraitPhone();
  const pick = (next: WorldLevel) => {
    void tryLockLandscape();
    setLevel(next);
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
      {level ? (
        <Level
          key={level.id}
          level={level}
          onExit={() => setLevel(null)}
          onDone={(earned) => setStars(saveStars(level.id, earned))}
        />
      ) : (
        <WorldMap stars={stars} onPick={pick} />
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
