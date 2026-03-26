// src/hooks/useSSE.js — replaces useNotifications polling with SSE
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/clerk-react";

export function useSSE({ onAlert, onOdds } = {}) {
  const { getToken, isSignedIn } = useAuth();
  const esRef       = useRef(null);
  const retryRef    = useRef(0);
  // Store callbacks in refs to avoid re-establishing the SSE connection
  // when the parent component re-renders with new callback references.
  const onAlertRef  = useRef(onAlert);
  const onOddsRef   = useRef(onOdds);
  const [connected, setConnected] = useState(false);

  // Keep refs fresh without triggering reconnects
  useEffect(() => { onAlertRef.current = onAlert; }, [onAlert]);
  useEffect(() => { onOddsRef.current = onOdds; }, [onOdds]);

  useEffect(() => {
    if (!isSignedIn) return;

    let cancelled = false;

    async function connect() {
      if (cancelled) return;
      if (esRef.current) { esRef.current.close(); esRef.current = null; }

      const token = await getToken();
      if (cancelled) return;

      // Probe the endpoint first to catch 401/403 before opening SSE
      try {
        const probe = await fetch(`/api/stream?token=${encodeURIComponent(token)}`, {
          method: "HEAD",
          signal: AbortSignal.timeout(5000),
        });
        if (probe.status === 401 || probe.status === 403) {
          console.warn("[useSSE] Auth failed, stopping reconnect");
          return;
        }
      } catch { /* network down — fall through to SSE which will retry */ }

      const url = `/api/stream?token=${encodeURIComponent(token)}`;
      const es  = new EventSource(url);
      esRef.current = es;

      es.addEventListener("connected", () => {
        setConnected(true);
        retryRef.current = 0; // reset backoff on success
      });

      es.addEventListener("odds", e => {
        try { onOddsRef.current?.(JSON.parse(e.data)); } catch { /* ignore parse error */ }
      });

      es.addEventListener("alert", e => {
        try {
          const alert = JSON.parse(e.data);
          onAlertRef.current?.(alert);

          // Trigger browser notification if permitted
          if (Notification.permission === "granted") {
            const dir = alert.move > 0 ? "📈" : "📉";
            new Notification(`${dir} Line moved — ${alert.matchup}`, {
              body: `${alert.side}: ${alert.from > 0 ? "+" : ""}${alert.from} → ${alert.to > 0 ? "+" : ""}${alert.to}`,
              icon: "/icons/icon-192.png",
              tag:  alert.tag,
            });
          }
        } catch { /* ignore */ }
      });

      es.onerror = () => {
        setConnected(false);
        es.close();
        esRef.current = null;
        // Exponential backoff: 2s, 4s, 8s, up to 60s
        const delay = Math.min(60_000, 2000 * Math.pow(2, retryRef.current));
        retryRef.current += 1;
        if (!cancelled) setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      cancelled = true;
      esRef.current?.close();
      esRef.current = null;
    };
  }, [isSignedIn, getToken]);

  return { connected };
}
