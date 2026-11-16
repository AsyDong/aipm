import type { ArcadeMode } from '@english/contracts';
import { arcadeGames } from './arcade';
import { allContent, definitionFor, type WorldLevel } from './content';
import { BackIcon, NextIcon } from './icons';

export function ArcadePicker({
  level,
  onPick,
  onBack,
}: {
  level: WorldLevel;
  onPick: (mode: ArcadeMode) => void;
  onBack: () => void;
}) {
  const content = definitionFor(level.game!).content;
  const words = content.items
    .map(({ contentId }) => allContent.find((item) => item.id === contentId))
    .filter((item) => !!item)
    .slice(0, 5);
  return (
    <section className="arcade-picker" aria-label="Game arcade">
      <div className="chapter-heading">
        <div>
          <h1>Choose a game</h1>
          <p>Your words load automatically. Just pick how to play!</p>
        </div>
        <button className="big-btn alt" onClick={onBack}>
          <BackIcon /> Back
        </button>
      </div>
      <div className="arcade-lesson" aria-label={`Words from ${level.title}`}>
        <div>
          <span>Now playing with</span>
          <strong>{level.title}</strong>
        </div>
        <div className="arcade-words">
          {words.map((word) => (
            <img key={word.id} src={word.assets.image} alt={word.text} />
          ))}
        </div>
      </div>
      <div className="arcade-grid">
        {arcadeGames.map((game) => (
          <button
            className="arcade-card"
            key={game.mode}
            onClick={() => onPick(game.mode)}
            aria-label={`Play ${game.title}`}
          >
            <span className="arcade-icon" aria-hidden>
              {game.icon}
            </span>
            <span className="arcade-copy">
              <strong>{game.title}</strong>
              <small>{game.tag}</small>
              <span>{game.instruction}</span>
            </span>
            <span className="arcade-go" aria-hidden>
              <NextIcon />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
