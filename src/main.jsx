import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import "./index.css";
import { queryClientConfig } from "./api.js";

// ── Query client ──────────────────────────────────────────────
const queryClient = new QueryClient(queryClientConfig);

// ── Mount ─────────────────────────────────────────────────────
const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("[PlusMinus] #root element not found. Check index.html.");

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);