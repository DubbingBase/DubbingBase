import { beforeEach, describe, expect, it, vi } from "vitest";
import { eligiblePushTokens, sendToken } from "./fcm";

describe("FCM delivery", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("targets only opted-in followers and deduplicates users and installation tokens", () => {
    expect(
      eligiblePushTokens(
        [{ user_id: "u1" }, { user_id: "u1" }, { user_id: "u2" }],
        [{ user_id: "u1" }, { user_id: "u2" }],
        [
          { user_id: "u1", fcm_token: "a", platform: "android", enabled: true },
          { user_id: "u1", fcm_token: "a", platform: "android", enabled: true },
          { user_id: "u2", fcm_token: "b", platform: "ios", enabled: false },
          { user_id: "u2", fcm_token: "c", platform: "desktop", enabled: true },
          { user_id: "u3", fcm_token: "d", platform: "ios", enabled: true },
        ],
      ),
    ).toEqual(["a"]);
  });

  it("retries temporary provider failures once and does not prune transient tokens", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 503 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const result = await sendToken(
      "test-project",
      "access-token",
      "fcm-token",
      {
        title: "New role",
        body: "A role was published",
        link: "https://dubbingbase.com/fr/movie/123",
        eventId: "event-1",
      },
    );
    expect(result).toBe("sent");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("marks only FCM UNREGISTERED errors as permanently invalid", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            details: [{ errorCode: "UNREGISTERED" }],
          },
        }),
        { status: 404 },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await sendToken(
      "test-project",
      "access-token",
      "expired-token",
      {
        title: "New role",
        body: "A role was published",
        link: "https://dubbingbase.com/fr/movie/123",
        eventId: "event-2",
      },
    );
    expect(result).toBe("invalid");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
