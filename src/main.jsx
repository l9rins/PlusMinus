import React from "react";
import ReactDOM from "react-dom/client";
import { inject } from "@vercel/analytics";
import { ClerkProvider } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import "./index.css";
import { queryClientConfig } from "./api.js";
import { registerSW } from "virtual:pwa-register";

const queryClient = new QueryClient(queryClientConfig);
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("[PlusMinus] #root not found in index.html");

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ClerkProvider>
  </React.StrictMode>
);

inject();


registerSW({
  onUpdatedSW() {
    // Could wire this into the Toast system — for now just reload
    console.info("[PlusMinus] App updated. Reloading.");
    window.location.reload();
  },
});
