/**
 * EvaluationCriteriaTable.tsx — Criteria table, read-only or editable.
 * Total updates live in edit mode. All inputs are accessible.
 */

interface Criterion {
  label: string;
  maxScore: number;
}

interface EvaluationCriteriaTableProps {
  criteria: Criterion[];
  scores?: Record<string, number>;
  onChange?: (label: string, score: number) => void;
  readOnly?: boolean;
}

export function EvaluationCriteriaTable({
  criteria,
  scores = {},
  onChange,
  readOnly = true,
}: EvaluationCriteriaTableProps) {
  // Empty state rules per plan
  if (criteria.length === 0) {
    if (readOnly) return null;
    return (
      <p className="comp-body" style={{ fontStyle: 'italic' }}>
        No evaluation criteria defined for this round.
      </p>
    );
  }

  const total = criteria.reduce((acc, c) => acc + (scores[c.label] ?? 0), 0);
  const maxTotal = criteria.reduce((acc, c) => acc + c.maxScore, 0);

  const cellStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderBottom: '1px solid var(--comp-border)',
    fontSize: 'var(--text-sm)',
    color: 'var(--comp-text-secondary)',
    textAlign: 'left' as const,
  };

  const headStyle: React.CSSProperties = {
    ...cellStyle,
    fontWeight: 600,
    color: 'var(--comp-text-primary)',
    background: 'var(--comp-accent-light)',
    fontSize: 'var(--text-xs)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  };

  return (
    <div
      style={{
        border: '1px solid var(--comp-border)',
        borderRadius: 8,
        overflowX: 'auto',
      }}
      aria-label="Evaluation criteria"
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={headStyle}>Criteria</th>
            <th style={{ ...headStyle, textAlign: 'right' as const }}>Max</th>
            {!readOnly && (
              <th style={{ ...headStyle, textAlign: 'right' as const, width: 90 }}>Score</th>
            )}
            {readOnly && scores && Object.keys(scores).length > 0 && (
              <th style={{ ...headStyle, textAlign: 'right' as const }}>Score</th>
            )}
          </tr>
        </thead>
        <tbody>
          {criteria.map((c) => {
            const currentScore = scores[c.label] ?? 0;
            const hasError = !readOnly && (currentScore < 0 || currentScore > c.maxScore);
            const errorId = `err-${c.label.replace(/\s+/g, '-')}`;

            return (
              <tr key={c.label}>
                <td style={cellStyle}>{c.label}</td>
                <td style={{ ...cellStyle, textAlign: 'right' as const }}>{c.maxScore}</td>
                {!readOnly ? (
                  <td style={{ ...cellStyle, textAlign: 'right' as const }}>
                    <input
                      type="number"
                      min={0}
                      max={c.maxScore}
                      value={currentScore}
                      onChange={(e) => onChange?.(c.label, Number(e.target.value))}
                      aria-label={`${c.label} score`}
                      aria-describedby={hasError ? errorId : undefined}
                      aria-invalid={hasError}
                      style={{
                        width: 64,
                        padding: '4px 8px',
                        border: `1px solid ${hasError ? 'var(--deadline-urgent)' : 'var(--comp-border)'}`,
                        borderRadius: 6,
                        fontSize: 'var(--text-sm)',
                        textAlign: 'right' as const,
                        background: 'var(--comp-surface)',
                        color: 'var(--comp-text-primary)',
                        outline: 'none',
                      }}
                    />
                    {hasError && (
                      <span id={errorId} style={{ color: 'var(--deadline-urgent)', fontSize: 'var(--text-xs)', display: 'block' }}>
                        0–{c.maxScore}
                      </span>
                    )}
                  </td>
                ) : Object.keys(scores).length > 0 ? (
                  <td style={{ ...cellStyle, textAlign: 'right' as const }}>{currentScore}</td>
                ) : null}
              </tr>
            );
          })}
          {/* Total row */}
          <tr style={{ background: 'var(--comp-accent-light)' }}>
            <td style={{ ...cellStyle, fontWeight: 700, color: 'var(--comp-text-primary)' }}>Total</td>
            <td style={{ ...cellStyle, fontWeight: 700, color: 'var(--comp-text-primary)', textAlign: 'right' as const }}>
              {maxTotal}
            </td>
            {(!readOnly || (readOnly && Object.keys(scores).length > 0)) && (
              <td
                style={{ ...cellStyle, fontWeight: 700, color: 'var(--comp-accent)', textAlign: 'right' as const }}
                aria-live="polite"
                aria-label={`Total score: ${total} of ${maxTotal}`}
              >
                {total}
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
