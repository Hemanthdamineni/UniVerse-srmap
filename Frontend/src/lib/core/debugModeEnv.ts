let _cached = false;
let _checkedEnv = false;
let _backendChecked = false;

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

export async function checkBackendDebugMode(): Promise<boolean> {
  if (_cached) return true;
  if (_backendChecked) return false;
  _backendChecked = true;
  try {
    const res = await fetch("/api/debug/ping");
    if (res.ok) {
      const data = await res.json();
      if (data.debugMode === true) {
        _cached = true;
        return true;
      }
    }
  } catch {
    _cached = false;
  }
  return false;
}
