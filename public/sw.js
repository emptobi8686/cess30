/* BLUEPRINT service worker: offline navigation fallback, Web Push display and
 * notification clicks. Pure logic lives in sw-core.js (unit-tested). */
importScripts("/sw-core.js");

var CACHE_VERSION = self.BlueprintSW.CACHE_VERSION;
var OFFLINE_URL = "/offline.html";
var PRECACHE = [OFFLINE_URL, "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(function (cache) {
        return cache.addAll(PRECACHE);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    (async function () {
      var keys = await caches.keys();
      await Promise.all(
        keys
          .filter(function (key) {
            return key.indexOf("blueprint-static-") === 0 && key !== CACHE_VERSION;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;

  event.respondWith(
    (async function () {
      try {
        return await fetch(request);
      } catch (error) {
        // Aborted navigations are not "offline".
        if (error && error.name === "AbortError") return Response.error();
        var cache = await caches.open(CACHE_VERSION);
        return (await cache.match(OFFLINE_URL)) || Response.error();
      }
    })()
  );
});

self.addEventListener("push", function (event) {
  var message = self.BlueprintSW.parsePushPayload(event.data);
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { target: message.target },
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var target = self.BlueprintSW.getSafeTarget(event.notification.data && event.notification.data.target);
  var url = new URL(target, self.location.origin).href;

  event.waitUntil(
    (async function () {
      var windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (var i = 0; i < windows.length; i++) {
        var client = windows[i];
        if (new URL(client.url).origin === self.location.origin && "focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
