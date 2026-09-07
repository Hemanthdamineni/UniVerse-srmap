let _cached = false;
let _checkedEnv = false;

export function isDebugMode(): boolean {
  if (typeof window === "undefined") return false;
  if (!_checkedEnv) {
    _checkedEnv = true;
    if (
      import.meta.env.VITE_DEBUG_MODE === "true" ||
      import.meta.env.VITE_DEBUG_MODE === "1"
    ) {
      _cached = true;
    }
  }
  return _cached;
}
