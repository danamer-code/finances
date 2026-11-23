"use client";

import { useEffect } from "react";

/**
 * Registra el service worker (public/sw.js). En desenvolupament no, perquè la memòria cau interferiria amb
 * els canvis en calent; per provar-lo en local, `localStorage.setItem("sw-dev", "1")`.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let devOptIn = false;
    try {
      devOptIn = localStorage.getItem("sw-dev") === "1";
    } catch {}
    if (process.env.NODE_ENV !== "production" && !devOptIn) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
  }, []);
  return null;
}
