// src/hooks/useSSE.js — replaces useNotifications polling with SSE
import { useEffect, useRef, useCallback, useState } from "react";
import { useAuth } from "@clerk/clerk-react";

export function useSSE({ onAlert, onOdds } = {}) {
  const { getToken, isSignedIn } = useAuth();
  const esRef    = useRef(null);
  const retryRef = useRef(0);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(async () => {
    if (!isSignedIn) return;
    if (esRef.current) { esRef.current.close(); esRef.current = null; }

    const token = await getToken();
    const url   = `/api/stream?token=${encodeURIComponent(token)}`;
    const es    = new EventSource(url);
    esRef.current = es;

    es.addEventListener("connected", () => {
      setConnected(true);
      retryRef.current = 0; // reset backoff on success
    });

    es.addEventListener("odds", e => {
      try { onOdds?.(JSON.parse(e.data)); } catch { /* ignore parse error */ }
    });

    es.addEventListener("alert", e => {
      try {
        const alert = JSON.parse(e.data);
        onAlert?.(alert);

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
      setTimeout(connect, delay);
    };
  }, [isSignedIn, getToken, onAlert, onOdds]);

  useEffect(() => {
    connect();
    return () => { esRef.current?.close(); };
  }, [connect]);

  return { connected };
}
