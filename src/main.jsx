import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import "./index.css";
import { queryClientConfig } from "./api.js";

const queryClient = new QueryClient(queryClientConfig);

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("[PlusMinus] #root not found in index.html");

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
