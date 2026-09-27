const P = {
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
  back: (
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
