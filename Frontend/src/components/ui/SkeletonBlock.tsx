import React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  circle?: boolean;
}

export function SkeletonBlock({
  className,
  width = '100%',
  height = '1rem',
  circle = false,
  ...props
}: SkeletonBlockProps) {
  return (
    <div
      className={cn('skeleton-shimmer', className)}
      style={{
        width,
        height,
        borderRadius: circle ? '50%' : 'var(--border-radius-lg, 12px)',
        ...props.style,
      }}
      {...props}
    />
  );
}
