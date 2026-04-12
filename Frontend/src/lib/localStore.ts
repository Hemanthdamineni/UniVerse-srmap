/**
 * localStorage-backed persistence layer for non-ERP domain data.
 * Provides type-safe CRUD for data managed by admin users.
 * Each store key maps to a JSON array of records.
 */

export function readStore<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(`erp:${key}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeStore<T>(key: string, data: T[]): void {
  localStorage.setItem(`erp:${key}`, JSON.stringify(data));
}

export function appendToStore<T>(key: string, item: T): T[] {
  const current = readStore<T>(key);
  const next = [item, ...current];
  writeStore(key, next);
  return next;
}

export function updateInStore<T extends { id: string }>(key: string, id: string, updater: (item: T) => T): T[] {
  const current = readStore<T>(key);
  const next = current.map((item) => (item.id === id ? updater(item) : item));
  writeStore(key, next);
  return next;
}

export function removeFromStore<T extends { id: string }>(key: string, id: string): T[] {
  const current = readStore<T>(key);
  const next = current.filter((item) => item.id !== id);
  writeStore(key, next);
  return next;
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}
