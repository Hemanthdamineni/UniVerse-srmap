/**
 * The UniVerse wordmark, drawn as inline SVG.
 *
 * Replaces `assets/Icons/horizontal_logo.png`, which was a photograph of a
 * printed sign: it carried a baked-in off-white background that showed as a
 * pale rectangle in dark mode and glare/scan artefacts in light mode.
 *
 * Colours come from CSS custom properties, so the mark tracks the theme:
 *   - the monogram + ring use `--comp-accent` (teal in light, brighter in dark)
 *   - the wordmark uses `currentColor`, so the caller sets the tone via `color`
 *
 * `titleId` must be unique per document; pass an explicit one when more than one
 * instance can mount at once (e.g. sidebar + a dialog).
 */

type Props = {
  /** Overall height in px; width scales with the viewBox. */
  height?: number;
  /** Drop the "SRMAP EDITION" line for tight placements. */
  compact?: boolean;
  className?: string;
  title?: string;
  titleId?: string;
};

export default function UniVerseWordmark({
  height = 36,
  compact = false,
  className,
  title = "UniVerse — SRMAP Edition",
  titleId = "universe-wordmark-title",
}: Props) {
  const viewBoxW = compact ? 150 : 208;

  return (
    <svg
      role="img"
      aria-labelledby={titleId}
      viewBox={`0 0 ${viewBoxW} 48`}
      height={height}
      width={(height * viewBoxW) / 48}
      className={className}
      style={{ display: "block", color: "var(--text-primary)" }}
    >
      <title id={titleId}>{title}</title>

      {/* Monogram: overlapping U + V inside an orbiting ring */}
      <g fill="none" stroke="var(--comp-accent)" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 9 V26 a9 9 0 0 0 18 0 V9" strokeWidth="4.4" />
        <path d="M20 9 L29 34 L38 9" strokeWidth="4.4" />
        <ellipse
          cx="24"
          cy="24"
          rx="22"
          ry="8.5"
          transform="rotate(-24 24 24)"
          strokeWidth="2.6"
          opacity="0.9"
        />
      </g>
      <g fill="var(--comp-accent)">
        <path d="M43 12 l1.3 3 3 1.3 -3 1.3 -1.3 3 -1.3 -3 -3 -1.3 3 -1.3 z" />
        <path d="M6 33 l1 2.2 2.2 1 -2.2 1 -1 2.2 -1 -2.2 -2.2 -1 2.2 -1 z" opacity="0.75" />
      </g>

      {/* Wordmark */}
      <text
        x="54"
        y={compact ? "31" : "25"}
        fill="currentColor"
        fontFamily="'Inter', 'Segoe UI', system-ui, sans-serif"
        fontWeight="700"
        fontSize="22"
        letterSpacing="-0.5"
      >
        Uni<tspan fill="var(--comp-accent)">Verse</tspan>
      </text>

      {!compact && (
        <text
          x="55"
          y="40"
          fill="currentColor"
          opacity="0.62"
          fontFamily="'Inter', 'Segoe UI', system-ui, sans-serif"
          fontWeight="600"
          fontSize="9"
          letterSpacing="1.6"
        >
          SRMAP EDITION
        </text>
      )}
    </svg>
  );
}
