import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";

const RETRY_DELAY_MS = 3000;
const MAX_RETRIES = 5;

export function useSSE({ onAlert }) {
  const { getToken } = useAuth();
  const eventSourceRef = useRef(null);
  const retryCount = useRef(0);
  const retryTimer = useRef(null);
  const isMounted = useRef(true);

  const connect = useCallback(async () => {
    if (!isMounted.current) return;

    // Always fetch a fresh token — never reuse the previous one
    let token;
    try {
      token = await getToken({ skipCache: true });
    } catch (err) {
      console.error("[SSE] Failed to get token:", err);
      return;
    }

    if (!token || !isMounted.current) return;

    // Clean up any existing connection before opening a new one
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const url = `/api/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      retryCount.current = 0; // Reset retry counter on successful connection
    };

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "alert" && onAlert) onAlert(data);
      } catch (err) {
        console.error("[SSE] Parse error:", err);
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;

      if (!isMounted.current) return;

      if (retryCount.current >= MAX_RETRIES) {
        console.warn("[SSE] Max retries reached, giving up");
        return;
      }

      retryCount.current += 1;
      const delay = RETRY_DELAY_MS * retryCount.current; // Back-off: 3s, 6s, 9s…
      console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${retryCount.current})`);

      // Key fix: always call connect() which fetches a NEW token, not just a new EventSource
      retryTimer.current = setTimeout(connect, delay);
    };
  }, [getToken, onAlert]);

  useEffect(() => {
    isMounted.current = true;
    connect();

    return () => {
      isMounted.current = false;
      clearTimeout(retryTimer.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [connect]);
}
