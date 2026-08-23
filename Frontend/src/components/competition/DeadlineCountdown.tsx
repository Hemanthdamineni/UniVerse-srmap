/**
 * DeadlineCountdown.tsx — Live countdown with urgency-aware colors.
 * Wraps in <time> for screen reader accessibility.
 */

import { useEffect, useState } from 'react';

interface DeadlineCountdownProps {
  deadline: string;    // ISO string
  showIcon?: boolean;
  compact?: boolean;   // "2d 4h" vs "2 days, 4 hours left"
}

function formatDiff(ms: number, compact: boolean): string {
  if (ms <= 0) return 'Deadline passed';

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (compact) {
    if (days > 0) return `${days}d ${hours}h left`;
    if (hours > 0) return `${hours}h ${minutes}m left`;
    return `${minutes}m left`;
  }

  if (days > 0) return `${days} day${days !== 1 ? 's' : ''}, ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes} min left`;
}

function getColor(ms: number): string {
  if (ms <= 0) return 'var(--comp-text-muted)';
  const days = ms / (1000 * 60 * 60 * 24);
  if (days < 3) return 'var(--deadline-urgent)';
  if (days < 7) return 'var(--deadline-warn)';
  return 'var(--deadline-safe)';
}

export function DeadlineCountdown({
  deadline,
  showIcon = true,
  compact = false,
}: DeadlineCountdownProps) {
  const [diff, setDiff] = useState(() => new Date(deadline).getTime() - Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setDiff(new Date(deadline).getTime() - Date.now());
    }, 60_000);
    return () => clearInterval(timer);
  }, [deadline]);

  const color = getColor(diff);
  const text = formatDiff(diff, compact);
  const passed = diff <= 0;

  return (
    <time
      dateTime={deadline}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        color,
        fontSize: 'var(--text-sm)',
        fontWeight: 500,
      }}
    >
      {showIcon && !passed && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )}
      {text}
    </time>
  );
}
