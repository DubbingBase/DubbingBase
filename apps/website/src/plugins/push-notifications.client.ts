import { getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, isSupported, onMessage } from "firebase/messaging";
import { detectPushSupport } from "../utils/push-support";
import { reconcilePushInstallation } from "../composables/usePushNotifications";

export default defineNuxtPlugin(() => {
  const user = useSupabaseUser();
  let currentUserId: string | null = null;
  let stopListening: (() => void) | null = null;

  const reconcile = async () => {
    if (!user.value) return;
    await reconcilePushInstallation();
    const support = detectPushSupport();
    if (support.eligibility !== "ready" || Notification.permission !== "granted") return;

    const config = useRuntimeConfig().public;
    if (
      !config.firebaseApiKey ||
      !config.firebaseAppId ||
      !config.firebaseMessagingSenderId ||
      !config.firebaseProjectId
    ) return;

    try {
      if (!(await isSupported())) return;
      const app = getApps().length > 0
        ? getApp()
        : initializeApp({
            apiKey: config.firebaseApiKey,
            appId: config.firebaseAppId,
            messagingSenderId: config.firebaseMessagingSenderId,
            projectId: config.firebaseProjectId,
          });
      const messaging = await getMessaging(app);
      stopListening?.();
      stopListening = onMessage(messaging, (payload) => {
        const data = payload.data;
        if (!data?.title || !data.body || !data.link) return;
        void navigator.serviceWorker.ready.then((registration) =>
          registration.showNotification(data.title, {
            body: data.body,
            tag: data.eventId || undefined,
            data: { link: data.link },
          }),
        );
      });
    } catch (error) {
      console.warn("Foreground push handling could not start", error);
    }
  };

  watch(
    () => user.value?.id ?? null,
    (userId) => {
      if (!userId) {
        currentUserId = null;
        stopListening?.();
        stopListening = null;
        return;
      }
      if (currentUserId !== userId) {
        currentUserId = userId;
        void reconcile();
      }
    },
    { immediate: true },
  );

  const onVisible = () => {
    if (document.visibilityState === "visible") void reconcile();
  };
  document.addEventListener("visibilitychange", onVisible);
  onScopeDispose(() => {
    document.removeEventListener("visibilitychange", onVisible);
    stopListening?.();
  });
});
