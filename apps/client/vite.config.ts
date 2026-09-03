import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { createMockApiMiddleware } from "./src/mockApiServer";

function mockApiPlugin(): Plugin {
  return {
    name: "mock-api-plugin",
    configureServer(server) {
      server.middlewares.use(createMockApiMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createMockApiMiddleware());
    },
  };
}

export default defineConfig({
  plugins: [react(), mockApiPlugin()],
  server: {
    host: "0.0.0.0",
    port: 3000,
  },
  preview: {
    host: "0.0.0.0",
    port: 3000,
  },
});
