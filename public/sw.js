const CACHE_NAME = "blueprint-static-v1";
const OFFLINE_URL = "/offline.html";

function getSafeTarget(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    /[\u0000-\u001f]/.test(value)
  ) {
    return "/notifications";
  }
  return value;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([
        OFFLINE_URL,
        "/manifest.webmanifest",
        "/icons/icon-192.png",
        "/icons/icon-512.png",
      ])
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("blueprint-static-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch((error) => {
        // Aborted requests (e.g. navigation cancelled) must not be reported
        // to the user as "offline". Only genuine network failures surface the
        // offline fallback; authentication and server errors are handled by the
        // application (redirects to /login, server error pages) instead.
        if (error instanceof DOMException && error.name === "AbortError") {
          return Response.error();
        }
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      })
    );
    return;
  }

  // Only public, immutable framework assets and the app shell metadata are cached.
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.startsWith("/icons/");
  if (!isStaticAsset) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok && response.type === "basic") {
        await cache.put(request, response.clone());
      }
      return response;
    })
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    const parsed = event.data ? event.data.json() : {};
    payload =
      typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
        ? parsed
        : {};
  } catch {
    payload = {};
  }

  const title =
    typeof payload.title === "string" ? payload.title : "BLUEPRINT Reminder";
  const body =
    typeof payload.body === "string"
      ? payload.body
      : "You have an upcoming academic activity.";
  const target = getSafeTarget(payload.actionUrl);

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: typeof payload.notificationId === "string" ? payload.notificationId : undefined,
      data: { target },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = getSafeTarget(event.notification.data?.target);
  event.waitUntil(    self.clients.openWindow(new URL(path, self.origin).href));
});
