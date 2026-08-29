import React from "react";
import { Award, TrendingUp, ListChecks, Sparkles } from "lucide-react";
import type { ScoreBreakdown } from "../../lib/events/competitionsApi";
import { CompetitionCard } from "./CompetitionChrome";

interface ScoreCardProps {
  title: string;
  breakdown: ScoreBreakdown;
  icon?: React.ReactNode;
  /** Short blurb under the headline (e.g. "Based on participation, …"). */
  blurb?: string;
  className?: string;
}

const BAND_COLOR: Record<string, string> = {
  excellent: "var(--success)",
  strong: "var(--comp-accent)",
  building: "var(--warning, #d97706)",
  starting: "var(--text-secondary)",
  none: "var(--text-secondary)",
};

const BAND_ICON: Record<string, React.ReactNode> = {
  excellent: <Sparkles className="h-3.5 w-3.5" aria-hidden />,
  strong: <TrendingUp className="h-3.5 w-3.5" aria-hidden />,
  building: <ListChecks className="h-3.5 w-3.5" aria-hidden />,
  starting: <ListChecks className="h-3.5 w-3.5" aria-hidden />,
  none: <ListChecks className="h-3.5 w-3.5" aria-hidden />,
};

function pct(points: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((points / max) * 100)));
}

function getCtaHint(breakdown: ScoreBreakdown): string | null {
  const dims = breakdown.dimensions;
  if (!dims || dims.length === 0) return null;
  const candidates = dims
    .map((d) => ({ dim: d, headroom: d.max - d.points }))
    .filter((c) => c.headroom > 0)
    .sort((a, b) => a.dim.progressPct - b.dim.progressPct);
  if (candidates.length === 0) return "All dimensions maxed — outstanding.";
  return `Focus next: ${candidates[0].dim.label.toLowerCase()}.`;
}

const ScoreCard: React.FC<ScoreCardProps> = ({
  title,
  breakdown,
  icon,
  blurb,
  className = "",
}) => {
  const score = breakdown?.score ?? 0;
  const overallPct = Math.max(0, Math.min(100, Math.round(score)));
  const dimensions = breakdown?.dimensions ?? [];
  const headlineBand = breakdown?.headlineBand ?? "No activity yet";
  const headlineColor = BAND_COLOR[dimensions[0]?.band] || "var(--text-secondary)";
  const ctaHint = getCtaHint(breakdown);

  return (
    <CompetitionCard className={`activity-score-card score-card ${className}`}>
      <div className="score-card-head">
        <div className="score-card-icon" aria-hidden>
          {icon ?? <Award size={28} />}
        </div>
        <div className="score-card-head-text">
          <h2>{title}</h2>
          <span
            className="score-card-band"
            style={{ color: headlineColor }}
            title={headlineBand}
          >
            {BAND_ICON[dimensions[0]?.band]} {headlineBand}
          </span>
        </div>
        <div className="score-card-headline">
          <strong>{score}</strong>
          <span>/ 100</span>
        </div>
      </div>

      <div
        className="score-card-bar"
        role="progressbar"
        aria-valuenow={overallPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${title} overall progress`}
      >
        <div
          className="score-card-bar-fill"
          style={{
            width: `${overallPct}%`,
            background: `linear-gradient(90deg, ${headlineColor}, color-mix(in srgb, ${headlineColor} 60%, var(--surface)))`,
          }}
        />
      </div>

      {blurb ? <p className="score-card-blurb">{blurb}</p> : null}

      {dimensions.length > 0 ? (
        <ul className="score-card-dimensions">
          {dimensions.map((dim) => {
            const dimPct = pct(dim.points, dim.max);
            const color = BAND_COLOR[dim.band] || "var(--text-secondary)";
            return (
              <li key={dim.id} className="score-dimension">
                <div className="score-dimension-row">
                  <span className="score-dimension-label">{dim.label}</span>
                  <span className="score-dimension-points">
                    <strong>{dim.points}</strong>
                    <span className="score-dimension-max">/ {dim.max}</span>
                  </span>
                </div>
                <div
                  className="score-dimension-bar"
                  role="progressbar"
                  aria-valuenow={dimPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${dim.label} progress`}
                >
                  <div
                    className="score-dimension-bar-fill"
                    style={{ width: `${dimPct}%`, background: color }}
                  />
                </div>
                <p className="score-dimension-summary">{dim.summary}</p>
              </li>
            );
          })}
        </ul>
      ) : null}

      {ctaHint ? <p className="score-card-cta">{ctaHint}</p> : null}
    </CompetitionCard>
  );
};

export default ScoreCard;
