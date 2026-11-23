/* Service worker de Finances: obrir l'app sense connexió i notificacions.
 *
 * - Pàgines: primer la xarxa; si no n'hi ha, l'última còpia desada d'aquella pàgina (o d'Avui o l'alta ràpida).
 * - Fitxers de /_next/static: porten el hash al nom, així que es poden servir de la memòria.
 * - Res més (accions, dades, API) passa pel service worker: sempre va a la xarxa.
 */
const VERSION = "v3";
const PAGES = `finances-pages-${VERSION}`;
const STATIC = `finances-static-${VERSION}`;
const FALLBACK_PAGES = ["/nou", "/"];

// Pàgina sense connexió quan no hi ha cap còpia desada. Aquí no es pot llegir la galeta de l'idioma: el missatge va
// en els tres idiomes de l'app, un sota l'altre (l'hebreu, de dreta a esquerra).
const OFFLINE_HTML = [
  '<!doctype html><html lang="ca"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
  '<body style="margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#0e0e0e;color:#f2f2ef;font-family:system-ui;text-align:center;padding:24px">',
  '<div style="display:flex;flex-direction:column;gap:20px;max-width:420px">',
  "<p lang=\"ca\" style=\"margin:0\">No hi ha connexió.<br>Obre l'app quan en tinguis i ja es podrà fer servir sense.</p>",
  "<p lang=\"en\" style=\"margin:0\">No connection.<br>Open the app once you're back online, and from then on it will work without one too.</p>",
  '<p lang="he" dir="rtl" style="margin:0">אין חיבור.<br>פתחו את האפליקציה כשיהיה חיבור, ומאז אפשר יהיה להשתמש בה גם בלעדיו.</p>',
  "</div></body></html>",
].join("");

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([PAGES, STATIC]);
      for (const key of await caches.keys()) if (!keep.has(key)) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request, url));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirstPage(request, url) {
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    // Només es desen pàgines bones de l'app (mai el login ni redireccions).
    if (response.ok && !response.redirected && !url.pathname.startsWith("/login")) {
      await cache.put(url.pathname, response.clone());
    }
    return response;
  } catch {
    const exact = await cache.match(url.pathname);
    if (exact) return exact;
    for (const path of FALLBACK_PAGES) {
      const page = await cache.match(path);
      if (page) return page;
    }
    return new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

// Missatges de l'app: esborrar les pàgines desades (en tancar sessió) i actualitzar el número de la icona.
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "clear-pages") event.waitUntil(caches.delete(PAGES));
  if (data.type === "badge") event.waitUntil(setBadge(data.count));
});

async function setBadge(count) {
  if (!self.navigator.setAppBadge) return;
  if (count > 0) await self.navigator.setAppBadge(count);
  else await self.navigator.clearAppBadge();
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Finances", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || "Finances", {
        body: data.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: data.tag,
        data: { url: data.url || "/" },
      }),
      typeof data.badge === "number" ? setBadge(data.badge) : Promise.resolve(),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) return client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })(),
  );
});
