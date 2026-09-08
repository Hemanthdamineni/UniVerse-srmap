/**
 * BrandLogo — the UniVerse / SRMAP Edition wordmark.
 *
 * The real brand artwork (`assets/Icons/horizontal_logo.png`, the "UV" orbit
 * monogram + "One Platform. Every Campus." tagline), trimmed to its bounding
 * box, resized and palette-reduced to ~25 KB. It carries a near-white photo
 * background, so on a dark surface (the app header bar, the login identity
 * panel) pass `plaque` to seat it on a matching white lozenge instead of
 * letting a bare rectangle float.
 */
import horizontalLogo from "../../assets/Icons/horizontal_logo.png";

type Props = {
  /** Rendered height in px; width scales with the artwork's aspect ratio. */
  height?: number;
  /** Wrap the mark in a white rounded lozenge for dark surfaces. */
  plaque?: boolean;
  className?: string;
};

export default function BrandLogo({ height = 40, plaque = false, className }: Props) {
  const img = (
    <img
      src={horizontalLogo}
      alt="UniVerse — SRMAP Edition"
      style={{ height, width: "auto" }}
      className="block max-w-full object-contain"
    />
  );

  if (plaque) {
    return (
      <span className={`inline-flex items-center rounded-lg bg-white px-2 py-1 ${className ?? ""}`}>
        {img}
      </span>
    );
  }

  return <span className={`inline-flex items-center ${className ?? ""}`}>{img}</span>;
}
