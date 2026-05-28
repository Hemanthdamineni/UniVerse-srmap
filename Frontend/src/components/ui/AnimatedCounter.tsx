import React, { useEffect, useState, useRef } from 'react';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  formatFn?: (val: number) => string;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1000,
  formatFn = (val) => val.toString(),
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const isInitialMount = useRef(true);
  const { ref, isVisible } = useIntersectionObserver({ threshold: 0, once: true });

  useEffect(() => {
    if (!isVisible) return;

    // If user prefers reduced motion, just set it instantly
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    if (prefersReducedMotion || isInitialMount.current) {
      setDisplayValue(value);
      isInitialMount.current = false;
      return;
    }

    let startTimestamp: number | null = null;
    const startValue = displayValue;
    const endValue = value;
    const valueDiff = endValue - startValue;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // easeOutExpo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      setDisplayValue(Math.round(startValue + valueDiff * easeProgress));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
      }
    };

    window.requestAnimationFrame(step);
  }, [value, duration, isVisible]);

  return <span ref={ref} className={`tabular-nums ${className}`}>{formatFn(displayValue)}</span>;
};
