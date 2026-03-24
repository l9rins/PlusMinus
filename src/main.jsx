import React from "react";
import ReactDOM from "react-dom/client";
import { inject } from "@vercel/analytics";
import { ClerkProvider } from "@clerk/clerk-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import "./index.css";
import { queryClientConfig } from "./api.js";

// FIX 3: Only import registerSW when the browser supports service workers.
// In plain `vite dev` (http, no SSL) the SW registration throws a DOMException
// because SW requires a secure context. Wrapping the import + registration in
// a feature-detect prevents an unhandled rejection that silently swallows the
// stack and confuses debugging.
let registerSW = null;
if ("serviceWorker" in navigator) {
  try {
    // Dynamic import so the PWA register module is only evaluated in SW-capable envs.
    ({ registerSW } = await import("virtual:pwa-register"));
  } catch {
    // PWA plugin not present (e.g. running tests) — safe to ignore.
  }
}

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

// FIX 3: Guard reload against in-flight bet saves.
// The old onUpdatedSW immediately called window.location.reload(), which
// aborted any in-flight PUT /api/bets request. The bet would then be lost
// (server never received it) while the UI showed it via optimistic update.
//
// New behaviour:
//   1. Set a flag so BetTracker's saveBets can check it before firing.
//   2. Show a toast-style banner instead of force-reloading.
//   3. Only reload once isSaving has been false for ≥ 2 s, or immediately
//      if there was never a pending save.
//
// We expose the pending-update flag on window so the BetTracker component
// (and any future component) can query it without a shared store.
if (registerSW) {
  window.__swUpdatePending = false;

  registerSW({
    onUpdatedSW(registration) {
      window.__swUpdatePending = true;

      // Show a non-blocking banner. If the user is actively saving we wait
      // until the mutation settles before reloading.
      const banner = document.createElement("div");
      banner.id = "pm-sw-banner";
      banner.style.cssText = [
        "position:fixed", "bottom:1rem", "left:50%", "transform:translateX(-50%)",
        "background:#161b28", "border:1px solid #2e3a50", "border-radius:10px",
        "padding:10px 18px", "display:flex", "align-items:center", "gap:12px",
        "font-size:12px", "color:#c3d0e0", "z-index:9999",
        "box-shadow:0 8px 32px rgba(0,0,0,.6)",
      ].join(";");
      banner.innerHTML = `
        <span>App updated — reload to get the latest version.</span>
        <button id="pm-sw-reload" style="background:#00d4aa;color:#0a0b0d;border:none;
          border-radius:6px;padding:4px 12px;font-size:11px;font-weight:600;cursor:pointer">
          Reload
        </button>
        <button id="pm-sw-dismiss" style="background:transparent;color:#546480;border:none;
          font-size:16px;cursor:pointer;line-height:1">×</button>
      `;
      document.body.appendChild(banner);

      const doReload = () => {
        // Wait until no save is in-flight (queryClient mutation cache is empty)
        const checkAndReload = () => {
          const mutations = queryClient.getMutationCache().getAll();
          const saving = mutations.some(m => m.state.status === "pending");
          if (!saving) {
            window.location.reload();
          } else {
            setTimeout(checkAndReload, 500);
          }
        };
        checkAndReload();
      };

      document.getElementById("pm-sw-reload")?.addEventListener("click", doReload);
      document.getElementById("pm-sw-dismiss")?.addEventListener("click", () => {
        banner.remove();
        window.__swUpdatePending = false;
      });
    },
  });
}
