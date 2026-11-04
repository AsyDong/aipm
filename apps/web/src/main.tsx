import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { BootstrapBridge, BootstrapState } from '@english/contracts';
import { createBootstrapBridge, mountBootstrapRuntime } from '@english/runtime';
import './style.css';

function GameContainer() {
  const host = useRef<HTMLDivElement>(null);
  const bridge = useRef<BootstrapBridge | null>(null);
  const [state, setState] = useState<BootstrapState>('READY');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!host.current) return;
    const channel = createBootstrapBridge(() => setError(true));
    bridge.current = channel.bridge;
    const unsubscribe = channel.bridge.subscribe((message) => {
      if (message.type === 'STATE_CHANGED') setState(message.state);
    });
    const dispose = mountBootstrapRuntime(
      host.current,
      channel.runtimePort,
      () => setError(true),
    );
    return () => {
      unsubscribe();
      dispose();
      channel.destroy();
      bridge.current = null;
    };
  }, []);

  return (
    <section aria-label="Adventure preview">
      <div className="canvas-host" ref={host} data-testid="game-host" />
      <div className="toolbar">
        <p role="status">
          {error
            ? 'Unable to load. Please reopen the preview.'
            : state === 'PAUSED'
              ? 'Paused'
              : state === 'RUNNING'
                ? 'Ready to explore'
                : 'Loading…'}
        </p>
        <button
          disabled={error || state === 'READY'}
          onClick={() =>
            bridge.current?.send({
              type: state === 'PAUSED' ? 'RESUME' : 'PAUSE',
            })
          }
        >
          {state === 'PAUSED' ? 'Resume' : 'Pause'}
        </button>
      </div>
    </section>
  );
}

function App() {
  const [open, setOpen] = useState(true);
  return (
    <main>
      <header>
        <a href="/" className="brand">
          English Adventure
        </a>
        <span>Explore. Listen. Discover.</span>
      </header>
      <div className="intro">
        <p className="eyebrow">THE JOURNEY BEGINS</p>
        <h1>
          Small discoveries.
          <br />A bigger world.
        </h1>
        <p>Make room for a little adventure.</p>
      </div>
      {open ? (
        <GameContainer />
      ) : (
        <div className="closed">
          <p>Your next adventure is waiting.</p>
        </div>
      )}
      <footer>
        <span>Adventure preview</span>
        <button onClick={() => setOpen(!open)}>
          {open ? 'Close preview' : 'Open preview'}
        </button>
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
