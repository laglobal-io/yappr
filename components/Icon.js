const HEART = "M12 20.3s-7.4-4.5-9.1-9.2C1.8 8 3.7 4.6 7.1 4.6c2 0 3.6 1.1 4.9 2.8 1.3-1.7 2.9-2.8 4.9-2.8 3.4 0 5.3 3.4 4.2 6.5-1.7 4.7-9.1 9.2-9.1 9.2z";

const P = {
  heart: <path d={HEART} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  heartFill: <path d={HEART} fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  share: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5v11" />
      <path d="M8 7.5l4-4 4 4" />
      <path d="M5.5 11.5v6.5a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-6.5" />
    </g>
  ),
  globe: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.4 2.4 3.5 5.2 3.5 8.5s-1.1 6.1-3.5 8.5c-2.4-2.4-3.5-5.2-3.5-8.5s1.1-6.1 3.5-8.5z" />
    </g>
  ),
  next: (
    <g fill="currentColor">
      <path d="M5 6.2v11.6a.9.9 0 0 0 1.4.75l8.4-5.8a.9.9 0 0 0 0-1.5L6.4 5.45A.9.9 0 0 0 5 6.2z" />
      <rect x="16.5" y="5" width="3" height="14" rx="1.5" />
    </g>
  ),
  mail: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5.5" width="18" height="13" rx="3.5" />
      <path d="M4.5 7.5l7.5 5.5 7.5-5.5" />
    </g>
  ),
  headphones: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <rect x="3" y="14" width="5" height="7" rx="2.5" />
      <rect x="16" y="14" width="5" height="7" rx="2.5" />
    </g>
  ),
  video: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="13" height="12" rx="3.5" />
      <path d="M16 10.5l5-3v9l-5-3" />
    </g>
  ),
  expand: <path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  shrink: <path d="M20 10h-6V4M4 14h6v6M14 10l7-7M10 14l-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  pip: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="3.5" />
      <rect x="12" y="11" width="6" height="5" rx="1.5" fill="currentColor" />
    </g>
  ),
  bell: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </g>
  ),
  radio: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" />
    </g>
  ),
  home: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11.5L12 5l8 6.5" />
      <path d="M6.5 10v8.5a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V10" />
    </g>
  ),
  library: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="4.5" height="16" rx="2" />
      <rect x="10.5" y="4" width="4.5" height="16" rx="2" />
      <path d="M17.2 5.2l3.3 14.3" />
    </g>
  ),
  back: <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
  user: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="8.5" r="4" />
      <path d="M4.5 20c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
    </g>
  ),
  moon: <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  queue: <path d="M4 6h12M4 11h12M4 16h7M17 14v6M14 17h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  queued: <path d="M4 6h12M4 11h12M4 16h7M14.5 17.5l2 2 4-4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  cast: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 8V6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14" />
      <path d="M3 12a8 8 0 0 1 8 8M3 16a4 4 0 0 1 4 4" />
      <circle cx="3.5" cy="19.5" r="0.6" fill="currentColor" />
    </g>
  ),
  compass: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </g>
  ),
  trend: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  plus: <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />,
  check: <path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />,
  repost: <path d="M7 7h9.5A2.5 2.5 0 0 1 19 9.5V12M17 17H7.5A2.5 2.5 0 0 1 5 14.5V12M14.5 4.5L17 7l-2.5 2.5M9.5 19.5L7 17l2.5-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  more: <g fill="currentColor"><circle cx="6" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="18" cy="12" r="1.8" /></g>,
  arrowUp: <path d="M12 19V6M6 11.5L12 5.5l6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
  arrowDown: <path d="M12 5v13M6 12.5l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
  comment: <path d="M5 5.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4.5 3.5V17.5H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  pen: <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  sparkle: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="currentColor" />,
  send: <path d="M4 12l16-8-6 16-2.5-6.5z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />,
  up: <path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
  play: <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.2-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor" />,
  pause: (
    <>
      <rect x="6" y="5" width="4.5" height="14" rx="2.2" fill="currentColor" />
      <rect x="13.5" y="5" width="4.5" height="14" rx="2.2" fill="currentColor" />
    </>
  ),
  search: (
    <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </g>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />,
  down: <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />,
  theme: (
    <g stroke="currentColor" strokeWidth="2" fill="none">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
    </g>
  ),
  wave: <path d="M4 10v4M8 7v10M12 4v16M16 8v8M20 11v2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  rewind: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12a8 8 0 1 0 2.4-5.7" />
      <path d="M4 4v4h4" />
      <text x="12.5" y="15.4" textAnchor="middle" fontSize="7" fontWeight="800" fill="currentColor" stroke="none">15</text>
    </g>
  ),
  fwd: (
    <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12a8 8 0 1 1-2.4-5.7" />
      <path d="M20 4v4h-4" />
      <text x="11.5" y="15.4" textAnchor="middle" fontSize="7" fontWeight="800" fill="currentColor" stroke="none">30</text>
    </g>
  ),
};

export default function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {P[name]}
    </svg>
  );
}

export function Dots() {
  return (
    <span className="loading-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}
