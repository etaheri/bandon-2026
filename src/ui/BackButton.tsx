import { go } from "../App";

/**
 * Top-bar back/home control. Uses an inline SVG arrow rather than a glyph so it
 * renders identically everywhere — the old `‹` character collapsed into a
 * paren-like shape in the Impact display font.
 */
export function BackButton({ to = "/", label = "Home" }: { to?: string; label?: string }) {
  return (
    <button className="bc-back" onClick={() => go(to)} aria-label={label}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path d="M15 5L8 12l7 7" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
