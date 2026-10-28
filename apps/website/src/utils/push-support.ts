export type PushPlatform = "android" | "ios";
export type PushEligibility = "ready" | "install-required" | "unsupported";

export interface PushSupportEnvironment {
  userAgent: string;
  iosDevice?: boolean;
  standalone: boolean;
  secureContext: boolean;
  notifications: boolean;
  serviceWorker: boolean;
  pushManager: boolean;
}

export interface PushSupport {
  eligibility: PushEligibility;
  platform: PushPlatform | null;
}

export function getPushSupport(environment: PushSupportEnvironment): PushSupport {
  if (
    !environment.secureContext ||
    !environment.notifications ||
    !environment.serviceWorker ||
    !environment.pushManager
  ) {
    return { eligibility: "unsupported", platform: null };
  }

  const isIos =
    environment.iosDevice === true || /iPhone|iPad|iPod/i.test(environment.userAgent);
  if (isIos) {
    const version = environment.userAgent.match(/OS (\d+)[._](\d+)/i) ??
      environment.userAgent.match(/Version\/(\d+)\.(\d+)/i);
    if (
      !version ||
      Number(version[1]) < 16 ||
      (Number(version[1]) === 16 && Number(version[2]) < 4)
    ) {
      return { eligibility: "unsupported", platform: null };
    }
    return environment.standalone
      ? { eligibility: "ready", platform: "ios" }
      : { eligibility: "install-required", platform: "ios" };
  }

  if (/Android/i.test(environment.userAgent)) {
    return environment.standalone
      ? { eligibility: "ready", platform: "android" }
      : { eligibility: "install-required", platform: "android" };
  }

  return { eligibility: "unsupported", platform: null };
}

export function detectPushSupport(): PushSupport {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { eligibility: "unsupported", platform: null };
  }
  const iosStandalone = "standalone" in navigator && navigator.standalone === true;
  return getPushSupport({
    userAgent: navigator.userAgent,
    iosDevice: /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    standalone: window.matchMedia("(display-mode: standalone)").matches || iosStandalone,
    secureContext: window.isSecureContext,
    notifications: "Notification" in window,
    serviceWorker: "serviceWorker" in navigator,
    pushManager: "PushManager" in window,
  });
}
