import { useEffect, useState } from "react";

// Returns a copy of `value` that lags behind by `delayMs`, so effects keyed
// on it don't fire per keystroke. The first render passes the value through.
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
