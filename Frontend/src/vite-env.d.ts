/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STATIC_PROTOTYPE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
