// The talking pebble. With `animated`, it blinks and yaps every now and then, and hops on hover.
export default function LogoMark({ animated = false }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={animated ? "pebble animated" : "pebble"}>
      <g className="pebble-bob">
        <path className="pebble-body" d="M32 9C50 8 61 19 61 33c0 14-12.5 23-29 23S3 47 3 33C3 19 15 10 32 9z" fill="var(--pebble, #7B3FF2)" />
        <g className="pebble-eyes">
          <circle cx="22.5" cy="26.5" r="3.6" fill="#fff" />
          <circle cx="41.5" cy="26.5" r="3.6" fill="#fff" />
        </g>
        <g className="pebble-mouth">
          <path d="M20.5 34.5Q32 50 43.5 34.5Z" fill="#fff" />
          <path d="M26.5 40.6Q32 46.5 37.5 40.6Q32 37.8 26.5 40.6Z" fill="#FF4F8B" />
        </g>
      </g>
    </svg>
  );
}
