import { useEffect, useState } from 'react';

const query = '(orientation: portrait) and (max-width: 900px)';

/** True on a phone or small tablet held upright: the game is designed for landscape. */
export function usePortraitPhone() {
  const [portrait, setPortrait] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const update = () => setPortrait(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return portrait;
}

type LockableOrientation = ScreenOrientation & {
  lock?: (orientation: 'landscape') => Promise<void>;
};

/**
 * Best effort: Android Chrome can lock landscape (fullscreen or installed app).
 * iOS Safari cannot be rotated by a page, so the portrait notice covers it.
 */
export async function tryLockLandscape() {
  try {
    // Locking needs fullscreen on Android; both must come from a tap.
    const small = matchMedia('(max-width: 900px), (max-height: 500px)').matches;
    if (small && !document.fullscreenElement)
      await document.documentElement.requestFullscreen?.();
    await (screen.orientation as LockableOrientation).lock?.('landscape');
  } catch {
    /* not allowed here (iOS, desktop): the portrait notice covers it */
  }
}
