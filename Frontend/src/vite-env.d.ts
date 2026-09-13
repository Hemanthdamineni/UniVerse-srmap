/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STATIC_PROTOTYPE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected via `define` in vite.config.ts — a per-build id used as the
// persisted-query-cache buster (see AppProviders.tsx / queryPersist.ts).
declare const __APP_BUILD_ID__: string;
