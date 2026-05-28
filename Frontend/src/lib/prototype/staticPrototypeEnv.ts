/**
 * When true, the app is built for static hosting with fixtures (no backend).
 * Set via `VITE_STATIC_PROTOTYPE=true` for `npm run build:static`.
 */
export function isStaticPrototype(): boolean {
  return (
    import.meta.env.VITE_STATIC_PROTOTYPE === "true" ||
    import.meta.env.VITE_STATIC_PROTOTYPE === "1"
  );
}
