const CACHE_VERSION = "cook-anything-phase4-v1";
const APP_SHELL = [
  "/",
  "/what-can-i-cook/",
  "/kitchen/",
  "/search-index.json",
  "/trust-manifest.json",
  "/manifest.webmanifest"
];

function isPrivateOrCompanion(request, url) {
  return request.headers.has("authorization")
    || request.headers.has("x-api-key")
    || url.pathname.startsWith("/api/")
    || url.pathname.startsWith("/companion-recipes/")
    || url.pathname.includes("companion");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => Promise.allSettled(APP_SHELL.map((path) => cache.add(path))))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("cook-anything") && name !== CACHE_VERSION).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CLEAR_LOCAL_CACHES") {
    event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("cook-anything")).map((name) => caches.delete(name)))));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || isPrivateOrCompanion(request, url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/")) || new Response("Offline", { status: 503 }))
    );
    return;
  }

  if (url.pathname === "/search-index.json" || url.pathname === "/trust-manifest.json") {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
          return response;
        }).catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || /\.(?:css|js|woff2?|png|jpe?g|webp|svg|ico)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
        return response;
      }))
    );
  }
});
