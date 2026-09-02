import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import "./styles.css";
import { AuthGate } from "./modules/auth/AuthGate";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

const isStandalonePrototype =
  new URLSearchParams(window.location.search).get("prototype") ===
  "warehouse-spatial";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {isStandalonePrototype ? (
        <App />
      ) : (
        <AuthGate>
          <App />
        </AuthGate>
      )}
    </QueryClientProvider>
  </React.StrictMode>,
);
