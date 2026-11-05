import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { GameViewState, IGameBridge } from '@english/contracts';
import { mountAdventure } from '@english/runtime';
import { allContent, definitionFor } from './content';
import './style.css';

function SpeakerIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 9h4l5-4v14l-5-4H4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GameContainer({ mode }: { mode: 'CURRICULUM' | 'DEMO' }) {
  const host = useRef<HTMLDivElement>(null);
  const bridge = useRef<IGameBridge | null>(null);
  const [state, setState] = useState<GameViewState>({
    lifecycle: 'INITIALIZING',
    round: 0,
    total: 5,
    stars: 0,
    feedback: 'LISTEN',
    busy: true,
  });
  const [error, setError] = useState('');
  const [muted, setMuted] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const game = mountAdventure(host.current, definitionFor(mode), allContent);
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
  }, [mode]);
  const active = state.lifecycle === 'RUNNING';
  const paused = state.lifecycle === 'PAUSED';
  const ready = state.lifecycle === 'READY';
  const completed = state.lifecycle === 'COMPLETED';
  const correct = state.feedback === 'CORRECT';
  const feedback = paused
    ? 'Take your time.'
    : ready
      ? 'Ready? Tap Let’s play.'
      : state.feedback === 'AUDIO_ERROR'
        ? 'Tap Listen to hear the word.'
        : correct
          ? 'You found it!'
          : state.feedback === 'RETRY'
            ? 'Listen again. Have another go.'
            : state.feedback === 'HINT'
              ? 'Tap the picture with the gold border.'
              : state.busy
                ? 'Listen closely…'
                : 'Find what you hear.';
  return (
    <section className="game" aria-label="Listen and Find game">
      <div className="game-top">
        <span className="location">
          <span className="location-dot" />
          {mode === 'CURRICULUM' ? 'FRUIT WORLD' : 'WOODLAND SAMPLER'}
        </span>
        <div
          className="journey"
          aria-label={`Round ${state.round} of ${state.total}`}
        >
          {Array.from({ length: state.total }, (_, i) => (
            <span
              className={
                i < state.round - (correct ? 0 : 1)
                  ? 'done'
                  : i === state.round - 1
                    ? 'current'
                    : ''
              }
              key={i}
            />
          ))}
        </div>
        <span className="stars" aria-label={`${state.stars} stars`}>
          ✦ <strong>{state.stars}</strong>
        </span>
      </div>
      <div className="stage">
        <div
          className="canvas-host"
          ref={host}
          data-testid="game-host"
          aria-label="Fruit choices. Listen, then tap a picture."
        />
        {(ready ||
          paused ||
          completed ||
          !!error ||
          state.lifecycle === 'INITIALIZING') && (
          <div className={`stage-overlay ${completed ? 'results' : ''}`}>
            {error ? (
              <>
                <span className="overlay-symbol">↻</span>
                <h2>Let’s try that again.</h2>
                <p>We couldn’t load this adventure.</p>
                <p className="error-detail">{error}</p>
              </>
            ) : completed ? (
              <>
                <span className="overlay-symbol">✦</span>
                <p className="eyebrow">ALL DONE</p>
                <h2>Great listening.</h2>
                <p>You found {state.total} fruits.</p>
                <div
                  className="result-stars"
                  aria-label={`${state.stars} stars earned`}
                >
                  {'✦'.repeat(state.stars)}
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    setMuted(false);
                    bridge.current?.send({ type: 'SET_VOLUME', value: 1 });
                    bridge.current?.send({ type: 'RESTART' });
                  }}
                >
                  Play again <span>↗</span>
                </button>
              </>
            ) : paused ? (
              <>
                <span className="overlay-symbol">Ⅱ</span>
                <h2>A little breather.</h2>
                <button
                  className="primary"
                  onClick={() => bridge.current?.send({ type: 'RESUME' })}
                >
                  Resume <span>→</span>
                </button>
              </>
            ) : ready ? (
              <>
                <span className="overlay-symbol">
                  <SpeakerIcon />
                </span>
                <p className="eyebrow">LISTEN & FIND</p>
                <h2>Listen, then tap.</h2>
                <p>Hear the word. Find the fruit. Tap it.</p>
                <div className="how-to" aria-hidden="true">
                  <span>① Listen</span>
                  <span>② Tap the fruit</span>
                  <span>③ Get a star</span>
                </div>
                <button
                  className="primary"
                  onClick={() => bridge.current?.send({ type: 'START' })}
                >
                  Let’s play <span>→</span>
                </button>
              </>
            ) : (
              <>
                <span className="loading-orbit" />
                <p>Getting ready…</p>
              </>
            )}
          </div>
        )}
        {active && (
          <div className="round-tag">
            {String(state.round).padStart(2, '0')}{' '}
            <span>/ {String(state.total).padStart(2, '0')}</span>
          </div>
        )}
      </div>
      <div className="game-controls">
        <div className="feedback">
          <span className={`feedback-dot ${correct ? 'success' : ''}`} />
          <p role="status" aria-live="polite">
            {error
              ? 'Please reopen the adventure.'
              : completed
                ? 'Adventure complete.'
                : feedback}
          </p>
        </div>
        <div className="actions">
          {active && (
            <>
              <button
                className="icon-button"
                aria-label={muted ? 'Unmute' : 'Mute'}
                onClick={() => {
                  bridge.current?.send({
                    type: 'SET_VOLUME',
                    value: muted ? 1 : 0,
                  });
                  setMuted(!muted);
                }}
              >
                <SpeakerIcon />
              </button>
              <button
                className="secondary"
                disabled={state.busy || correct}
                onClick={() => bridge.current?.send({ type: 'HINT' })}
              >
                ✧ Hint
              </button>
              {correct ? (
                <button
                  className="primary compact nudge"
                  onClick={() => bridge.current?.send({ type: 'NEXT' })}
                >
                  {state.round === state.total ? 'Finish' : 'Next'}{' '}
                  <span>→</span>
                </button>
              ) : (
                <button
                  className="primary compact"
                  disabled={state.busy}
                  onClick={() => bridge.current?.send({ type: 'REPLAY' })}
                >
                  <SpeakerIcon /> Listen
                </button>
              )}
              <button
                className="icon-button"
                aria-label="Pause"
                onClick={() => bridge.current?.send({ type: 'PAUSE' })}
              >
                Ⅱ
              </button>
            </>
          )}
        </div>
      </div>
      {completed && state.summary && (
        <details className="session-notes">
          <summary>Session notes</summary>
          <p>
            First choices: {state.summary.firstTryCorrect} /{' '}
            {state.summary.total} · Replays: {state.summary.replays} · Hints:{' '}
            {state.summary.hints}
          </p>
          <p>
            These observations help plan another listen. They are not a measure
            of vocabulary mastery.
          </p>
        </details>
      )}
    </section>
  );
}

function App() {
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState<'CURRICULUM' | 'DEMO'>('CURRICULUM');
  return (
    <main>
      <header>
        <a href="/" className="brand">
          <span className="brand-mark">
            e<span>✦</span>
          </span>{' '}
          English Adventure
        </a>
        <span className="header-note">A little listening. A bigger world.</span>
        <span className="edition">
          EXPLORER SERIES <span>01</span>
        </span>
      </header>
      <div className="intro">
        <div>
          <p className="eyebrow">LISTENING GAME</p>
          <h1>
            Listen. Find.
            <br />
            <em>Hear a word, tap the picture.</em>
          </h1>
        </div>
        <div className="intro-note">
          <span className="sketch-star">✳</span>
          <p>
            No timer. No hurry.
            <br />
            Listen again any time.
          </p>
        </div>
      </div>
      {open ? (
        <GameContainer key={mode} mode={mode} />
      ) : (
        <div className="closed">
          <p>Your next adventure is waiting.</p>
          <button className="primary" onClick={() => setOpen(true)}>
            Open adventure →
          </button>
        </div>
      )}
      <footer>
        <div>
          <span className="source-label">
            {mode === 'CURRICULUM' ? 'POWER UP 0 · UNIT 3' : 'INDEPENDENT DEMO'}
          </span>
          <p>
            {mode === 'CURRICULUM'
              ? 'Food shopping · Five fruit words'
              : 'A new word collection. The same adventure.'}
          </p>
        </div>
        <div className="footer-actions">
          <button
            className="text-button"
            onClick={() =>
              setMode(mode === 'CURRICULUM' ? 'DEMO' : 'CURRICULUM')
            }
          >
            {mode === 'CURRICULUM' ? 'Try the sampler' : 'Back to Unit 3'} ↗
          </button>
          <button className="text-button" onClick={() => setOpen(!open)}>
            {open ? 'Close adventure' : 'Open adventure'}
          </button>
        </div>
      </footer>
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
