import "@testing-library/jest-dom/vitest";

// localStorage mock for jsdom + React 19 compatibility.
// React 19's client renderer calls lazy useState initializers in a context
// where jsdom globals aren't always accessible via direct reference.
if (typeof globalThis.localStorage === "undefined" || typeof globalThis.localStorage.getItem !== "function") {
  const store: Record<string, string> = {};
  const mockStorage: Storage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() { return Object.keys(store).length; },
  };
  Object.defineProperty(globalThis, "localStorage", { value: mockStorage, writable: true, configurable: true });
}
