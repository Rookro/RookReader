/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to "true" for E2E builds to load the `@wdio/tauri-plugin` frontend bridge. */
  readonly VITE_E2E?: string;
}
