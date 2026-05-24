interface Props {
  /** Sized in `em` by default so it inherits the surrounding font size. */
  size?: string;
  className?: string;
}

/** Inline loading spinner. Uses `currentColor` so it matches button text. */
export default function Spinner({ size = '1em', className = '' }: Props) {
  return (
    <svg
      className={`animate-spin shrink-0 ${className}`}
      style={{ width: size, height: size }}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" strokeWidth="4" className="opacity-25" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        strokeWidth="4"
        strokeLinecap="round"
        className="opacity-90"
      />
    </svg>
  );
}
