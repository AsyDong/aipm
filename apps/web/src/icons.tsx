import type { ReactNode } from 'react';

const Svg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="icon">
    {children}
  </svg>
);
const stroke = {
  stroke: 'currentColor',
  strokeWidth: 2.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const SpeakerIcon = () => (
  <Svg>
    <path
      d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" {...stroke} />
  </Svg>
);
export const MutedIcon = () => (
  <Svg>
    <path
      d="M4 9.5h3.5L12 5.5v13l-4.5-4H4Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="m16 9.5 5 5m0-5-5 5" {...stroke} />
  </Svg>
);
export const BulbIcon = () => (
  <Svg>
    <path
      d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z"
      {...stroke}
    />
  </Svg>
);
export const PauseIcon = () => (
  <Svg>
    <path d="M8 5v14M16 5v14" {...stroke} strokeWidth="3.4" />
  </Svg>
);
export const BackIcon = () => (
  <Svg>
    <path d="M15 5 8 12l7 7" {...stroke} strokeWidth="3" />
  </Svg>
);
export const NextIcon = () => (
  <Svg>
    <path d="M5 12h13M12 5l7 7-7 7" {...stroke} strokeWidth="3" />
  </Svg>
);
export const PlayIcon = () => (
  <Svg>
    <path
      d="M8 5.5v13l11-6.5Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </Svg>
);
export const LockIcon = () => (
  <Svg>
    <rect x="5" y="11" width="14" height="9" rx="2.5" fill="currentColor" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" {...stroke} />
  </Svg>
);
export const StarIcon = () => (
  <Svg>
    <path
      d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8Z"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </Svg>
);
