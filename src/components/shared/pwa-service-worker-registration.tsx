"use client";

import { useEffect } from "react";

export function PwaServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      )
      .catch((error: unknown) => {
        console.error("BLUEPRINT service worker unregistration failed.", error);
      });

    if ("caches" in window) {
      void caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith("blueprint-static-"))
              .map((key) => caches.delete(key))
          )
        )
        .catch(() => undefined);
    }
  }, []);

  return null;
}
