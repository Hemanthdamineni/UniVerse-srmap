// Normalizes anything thrown by the transport layer into the message string
// the UI error contracts expect. Pages today store `error: string | null`;
// React Query hands back `unknown` — convert at the boundary, not in pages.
export function toErrorMessage(error: unknown, fallback = "Request failed"): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}
