import { describe, expect, it } from "vitest";
import { getPushSupport, needsPushTokenRevocation } from "./push-support";

const supported = {
  secureContext: true,
  notifications: true,
  serviceWorker: true,
  pushManager: true,
};

describe("mobile PWA push support", () => {
  it("revokes a cached browser token for a missing or changed account owner", () => {
    expect(needsPushTokenRevocation(null, "user-1")).toBe(true);
    expect(needsPushTokenRevocation("user-1", "user-2")).toBe(true);
    expect(needsPushTokenRevocation("user-1", "user-1")).toBe(false);
  });

  it("allows installed Android PWAs and asks browser users to install", () => {
    expect(
      getPushSupport({ ...supported, userAgent: "Android 14 Chrome", standalone: true }),
    ).toEqual({ eligibility: "ready", platform: "android" });
    expect(
      getPushSupport({ ...supported, userAgent: "Android 14 Chrome", standalone: false }),
    ).toEqual({ eligibility: "install-required", platform: "android" });
  });

  it("requires iOS 16.4 and Home Screen installation", () => {
    expect(
      getPushSupport({ ...supported, userAgent: "iPhone OS 16_3", standalone: true }),
    ).toEqual({ eligibility: "unsupported", platform: null });
    expect(
      getPushSupport({ ...supported, userAgent: "iPhone OS 16_4", standalone: false }),
    ).toEqual({ eligibility: "install-required", platform: "ios" });
    expect(
      getPushSupport({ ...supported, userAgent: "iPhone OS 17_0", standalone: true }),
    ).toEqual({ eligibility: "ready", platform: "ios" });
    expect(
      getPushSupport({
        ...supported,
        userAgent:
          "Macintosh; Intel Mac OS X 10_15 Version/16.3 Mobile/15E148",
        iosDevice: true,
        standalone: true,
      }),
    ).toEqual({ eligibility: "unsupported", platform: null });
    expect(
      getPushSupport({
        ...supported,
        userAgent:
          "Macintosh; Intel Mac OS X 10_15 Version/16.4 Mobile/15E148",
        iosDevice: true,
        standalone: true,
      }),
    ).toEqual({ eligibility: "ready", platform: "ios" });
  });

  it("never enables desktop or insecure contexts", () => {
    expect(
      getPushSupport({ ...supported, userAgent: "Desktop Chrome", standalone: true }),
    ).toEqual({ eligibility: "unsupported", platform: null });
    expect(
      getPushSupport({
        ...supported,
        userAgent: "Android Chrome",
        standalone: true,
        secureContext: false,
      }),
    ).toEqual({ eligibility: "unsupported", platform: null });
  });
});
