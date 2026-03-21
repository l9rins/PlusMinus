// src/hooks/useNotifications.js
//
// Polls /api/notify every 60s when the tab is focused and the user
// has granted notification permission. Shows browser notifications
// via the Notifications API — no push subscription infra needed.
//
// Usage (in App.jsx or AppInner):
//   import { useNotifications } from "./hooks/useNotifications";
//   function AppInner() {
//     useNotifications();   // call once at the root, no props needed
//     ...
//   }

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";

const POLL_INTERVAL_MS = 60_000;   // 60 s when focused
const BLUR_INTERVAL_MS = 300_000;  // 5 min when blurred
const NOTIF_PERMISSION_KEY = "pm_notif_asked";

export function useNotifications() {
    const { getToken, isSignedIn } = useAuth();
    const timerRef = useRef(null);
    const shownTags = useRef(new Set());   // dedup within session
    const isFocused = useRef(true);

    const requestPermission = useCallback(async () => {
        if (Notification.permission !== "default") return Notification.permission;
        // Only ask once per browser session
        if (sessionStorage.getItem(NOTIF_PERMISSION_KEY)) return Notification.permission;
        sessionStorage.setItem(NOTIF_PERMISSION_KEY, "1");
        return Notification.requestPermission();
    }, []);

    const poll = useCallback(async () => {
        if (!isSignedIn) return;
        if (Notification.permission !== "granted") return;

        try {
            const token = await getToken();
            const res = await fetch("/api/notify", {
                headers: { Authorization: `Bearer ${token}` },
                signal: AbortSignal.timeout(10_000),
            });
            if (!res.ok) return;
            const { notifications = [] } = await res.json();

            for (const n of notifications) {
                // Skip if we already showed this tag this session
                if (shownTags.current.has(n.tag)) continue;
                shownTags.current.add(n.tag);

                const notif = new Notification(n.title, {
                    body: n.body,
                    tag: n.tag,
                    icon: "/icons/icon-192.png",
                    badge: "/icons/badge-72.png",
                    requireInteraction: n.data?.urgent ?? false,
                });

                if (n.data?.url) {
                    notif.onclick = () => {
                        window.focus();
                        window.location.hash = n.data.url === "/" ? "" : n.data.url.replace(/^\//, "#/");
                        notif.close();
                    };
                }
            }
        } catch {
            // Network failure — silent, will retry next interval
        }
    }, [isSignedIn, getToken]);

    const schedule = useCallback(() => {
        clearTimeout(timerRef.current);
        const interval = isFocused.current ? POLL_INTERVAL_MS : BLUR_INTERVAL_MS;
        timerRef.current = setTimeout(async () => {
            await poll();
            schedule();
        }, interval);
    }, [poll]);

    useEffect(() => {
        if (!isSignedIn) return;
        if (!("Notification" in window)) return;

        // Ask for permission on first meaningful interaction
        const onInteract = () => {
            requestPermission().then(perm => {
                if (perm === "granted") { poll(); schedule(); }
            });
            window.removeEventListener("click", onInteract);
        };
        window.addEventListener("click", onInteract, { once: true });

        // If already granted, start immediately
        if (Notification.permission === "granted") {
            poll();
            schedule();
        }

        const onFocus = () => { isFocused.current = true; schedule(); };
        const onBlur = () => { isFocused.current = false; schedule(); };
        window.addEventListener("focus", onFocus);
        window.addEventListener("blur", onBlur);

        return () => {
            clearTimeout(timerRef.current);
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("blur", onBlur);
            window.removeEventListener("click", onInteract);
        };
    }, [isSignedIn, poll, schedule, requestPermission]);
}