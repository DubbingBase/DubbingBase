import { detectPushSupport, type PushPlatform } from "../utils/push-support";

export type PushEnableResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unsupported" | "install-required" | "denied" | "configuration" | "failed";
    };

function getInstallationId(): string {
  const key = "dubbingbase.push-installation-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const installationId = crypto.randomUUID();
  localStorage.setItem(key, installationId);
  return installationId;
}

async function registerCurrentToken(platform: PushPlatform): Promise<boolean> {
  const { locale } = useI18n();
  const config = useRuntimeConfig().public;
  if (
    !config.firebaseApiKey ||
    !config.firebaseAppId ||
    !config.firebaseMessagingSenderId ||
    !config.firebaseProjectId ||
    !config.firebaseVapidKey
  ) {
    return false;
  }

  try {
    const [{ getApp, getApps, initializeApp }, { getMessaging, getToken, isSupported }] =
      await Promise.all([import("firebase/app"), import("firebase/messaging")]);
    if (!(await isSupported())) return false;
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
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey: config.firebaseVapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return false;
    await $fetch("/api/push/installation", {
      method: "POST",
      body: { installation_id: getInstallationId(), platform, token, locale: locale.value },
    });
    return true;
  } catch (error) {
    console.warn("Push installation could not be registered", error);
    return false;
  }
}

export async function enablePushNotifications(): Promise<PushEnableResult> {
  const support = detectPushSupport();
  if (support.eligibility === "install-required") {
    return { ok: false, reason: "install-required" };
  }
  if (!support.platform || support.eligibility !== "ready") {
    return { ok: false, reason: "unsupported" };
  }
  if (!useSupabaseUser().value) return { ok: false, reason: "failed" };

  try {
    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission !== "granted") return { ok: false, reason: "denied" };
    const registered = await registerCurrentToken(support.platform);
    if (!registered) return { ok: false, reason: "configuration" };
    await $fetch("/api/push/settings", { method: "POST", body: { enabled: true } });
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export async function reconcilePushInstallation(): Promise<void> {
  const support = detectPushSupport();
  if (support.eligibility !== "ready" || !support.platform || !useSupabaseUser().value) {
    return;
  }
  if (Notification.permission !== "granted") {
    if (Notification.permission === "denied") await detachPushInstallation();
    return;
  }
  try {
    const settings = await $fetch<{ enabled: boolean }>("/api/push/settings");
    if (settings.enabled) await registerCurrentToken(support.platform);
  } catch (error) {
    console.warn("Push installation reconciliation failed", error);
  }
}

export async function detachPushInstallation(): Promise<boolean> {
  let serverDetached = false;
  try {
    const installationId = localStorage.getItem("dubbingbase.push-installation-id");
    if (!installationId) {
      serverDetached = true;
    } else {
      await $fetch("/api/push/installation", {
        method: "DELETE",
        body: { installation_id: installationId },
      });
      serverDetached = true;
    }
  } catch (error) {
    console.warn("Push installation could not be detached", error);
  }

  let tokenDeleted = false;
  try {
    const config = useRuntimeConfig().public;
    if (
      !config.firebaseApiKey ||
      !config.firebaseAppId ||
      !config.firebaseMessagingSenderId ||
      !config.firebaseProjectId
    ) {
      tokenDeleted = serverDetached;
    } else {
      const [{ getApp, getApps, initializeApp }, { deleteToken, getMessaging, isSupported }] =
        await Promise.all([import("firebase/app"), import("firebase/messaging")]);
      if (!(await isSupported())) {
        tokenDeleted = true;
      } else {
        const app =
          getApps().length > 0
            ? getApp()
            : initializeApp({
                apiKey: config.firebaseApiKey,
                appId: config.firebaseAppId,
                messagingSenderId: config.firebaseMessagingSenderId,
                projectId: config.firebaseProjectId,
              });
        await deleteToken(getMessaging(app));
        tokenDeleted = true;
      }
    }
  } catch (error) {
    console.warn("Browser push token could not be removed", error);
  }

  return serverDetached || tokenDeleted;
}
