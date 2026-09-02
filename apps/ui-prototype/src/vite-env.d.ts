/// <reference types="vite/client" />

declare module "*.css";

interface Document {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
}
