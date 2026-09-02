/// <reference types="vite/client" />

declare module "*.css";

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_REVERSE_GEOCODE_URL?: string;
}

interface Document {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
}
