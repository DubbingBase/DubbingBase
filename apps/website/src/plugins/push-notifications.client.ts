import { getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, isSupported, onMessage } from "firebase/messaging";
import { detectPushSupport } from "../utils/push-support";
import { reconcilePushInstallation } from "../composables/usePushNotifications";

export default defineNuxtPlugin((nuxtApp) => {
  const user = useSupabaseUser();
  const locale = nuxtApp.$i18n.locale;
  let currentUserId: string | null = null;
  let stopListening: (() => void) | null = null;

  const reconcile = async () => {
    if (!user.value) return;
    await reconcilePushInstallation(locale.value);
    const support = detectPushSupport();
    if (support.eligibility !== "ready" || Notification.permission !== "granted") return;

    const config = useRuntimeConfig().public;
    if (
      !config.firebaseApiKey ||
      !config.firebaseAppId ||
      !config.firebaseMessagingSenderId ||
      !config.firebaseProjectId
    )
      return;

    try {
      if (!(await isSupported())) return;
      const app =
        getApps().length > 0
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
        const title = payload.data?.title;
        const body = payload.data?.body;
        const link = payload.data?.link;
        if (!title || !body || !link) return;
        void navigator.serviceWorker.ready.then((registration) =>
          registration.showNotification(title, {
            body,
            tag: payload.data?.eventId || undefined,
            data: { link },
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

  watch(locale, () => {
    if (user.value) void reconcilePushInstallation(locale.value);
  });

  const onVisible = () => {
    if (document.visibilityState === "visible") void reconcile();
  };
  document.addEventListener("visibilitychange", onVisible);
  onScopeDispose(() => {
    document.removeEventListener("visibilitychange", onVisible);
    stopListening?.();
  });
});
