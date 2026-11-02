import {
  detectPushSupport,
  needsPushTokenRevocation,
  type PushPlatform,
} from "../utils/push-support";

export type PushEnableResult =
  | { ok: true }
  | {
      ok: false;
      reason: "unsupported" | "install-required" | "denied" | "configuration" | "failed";
    };

const accountOwnerKey = "dubbingbase.push-account-owner";

function getInstallationId(): string {
  const key = "dubbingbase.push-installation-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const installationId = crypto.randomUUID();
  localStorage.setItem(key, installationId);
  return installationId;
}

async function getMessagingForCurrentAccount(userId: string) {
  const config = useRuntimeConfig().public;
  if (
    !config.firebaseApiKey ||
    !config.firebaseAppId ||
    !config.firebaseMessagingSenderId ||
    !config.firebaseProjectId
  ) {
    return null;
  }

  const [{ getApp, getApps, initializeApp }, { deleteToken, getMessaging, isSupported }] =
    await Promise.all([import("firebase/app"), import("firebase/messaging")]);
  if (!(await isSupported())) return null;
  const app =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          apiKey: config.firebaseApiKey,
          appId: config.firebaseAppId,
          messagingSenderId: config.firebaseMessagingSenderId,
          projectId: config.firebaseProjectId,
        });
  const messaging = getMessaging(app);
  if (needsPushTokenRevocation(localStorage.getItem(accountOwnerKey), userId)) {
    if (!(await deleteToken(messaging))) return null;
    localStorage.setItem(accountOwnerKey, userId);
  }
  return { config, messaging };
}

async function registerCurrentToken(
  platform: PushPlatform,
  locale: string,
  userId: string,
): Promise<boolean> {
  try {
    const account = await getMessagingForCurrentAccount(userId);
    if (!account || !account.config.firebaseVapidKey) return false;
    const { getToken } = await import("firebase/messaging");
    const { config, messaging } = account;
    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
      vapidKey: config.firebaseVapidKey,
      serviceWorkerRegistration: registration,
    });
    if (!token) return false;
    await $fetch("/api/push/installation", {
      method: "POST",
      body: { installation_id: getInstallationId(), platform, token, locale },
    });
    return true;
  } catch (error) {
    console.warn("Push installation could not be registered", error);
    return false;
  }
}

export async function enablePushNotifications(locale: string): Promise<PushEnableResult> {
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
    const userId = useSupabaseUser().value?.id;
    if (!userId) return { ok: false, reason: "failed" };
    const registered = await registerCurrentToken(support.platform, locale, userId);
    if (!registered) return { ok: false, reason: "configuration" };
    await $fetch("/api/push/settings", { method: "POST", body: { enabled: true } });
    return { ok: true };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

export async function reconcilePushInstallation(locale: string): Promise<void> {
  const support = detectPushSupport();
  const userId = useSupabaseUser().value?.id;
  if (support.eligibility !== "ready" || !support.platform || !userId) {
    return;
  }
  try {
    const account = await getMessagingForCurrentAccount(userId);
    if (!account) return;
  } catch (error) {
    console.warn("Push account token could not be rotated", error);
    return;
  }
  if (Notification.permission !== "granted") {
    if (Notification.permission === "denied") await detachPushInstallation();
    return;
  }
  try {
    const settings = await $fetch<{ enabled: boolean }>("/api/push/settings");
    if (settings.enabled) await registerCurrentToken(support.platform, locale, userId);
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
        tokenDeleted = await deleteToken(getMessaging(app));
      }
    }
  } catch (error) {
    console.warn("Browser push token could not be removed", error);
  }

  return serverDetached || tokenDeleted;
}
