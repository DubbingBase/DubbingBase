/// <reference lib="webworker" />

import { initializeApp } from "firebase/app";
import { getMessaging, isSupported, onBackgroundMessage } from "firebase/messaging/sw";
import { createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const __FIREBASE_CONFIG__: {
  apiKey: string;
  appId: string;
  messagingSenderId: string;
  projectId: string;
};

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { revision: string | null; url: string }>;
};

precacheAndRoute(self.__WB_MANIFEST);
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") void self.skipWaiting();
});
registerRoute(
  new NavigationRoute(createHandlerBoundToURL("/offline.html"), {
    denylist: [/^\/api\//, /^\/_nuxt\//],
  }),
);

const app = initializeApp(__FIREBASE_CONFIG__);

function safeNotificationLink(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "dubbingbase.com"
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

void isSupported().then((supported) => {
  if (!supported) return;
  onBackgroundMessage(getMessaging(app), (payload) => {
    const data = payload.data;
    if (!data?.title || !data.body) return;
    const link = safeNotificationLink(data.link);
    return self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.eventId || undefined,
      data: { link },
    });
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = safeNotificationLink(
    typeof event.notification.data?.link === "string"
      ? event.notification.data.link
      : undefined,
  );
  if (!link) return;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing && "navigate" in existing) {
        return existing.navigate(link).then((client) => client?.focus());
      }
      return self.clients.openWindow(link);
    }),
  );
});
