import { describe, expect, it, vi } from "vitest";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { createAccessTokenCache, type AccessTokenAuthClient } from "./access-token-cache";

type SessionSnapshot = Pick<Session, "access_token">;

function createAuthMock(initialSession: SessionSnapshot | null) {
  let listener: ((event: AuthChangeEvent, session: SessionSnapshot | null) => void) | undefined;
  const auth: AccessTokenAuthClient = {
    getSession: vi.fn(async () => ({ data: { session: initialSession } })),
    onAuthStateChange: vi.fn((callback) => {
      listener = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
  };

  return {
    auth,
    emit(event: AuthChangeEvent, session: Session | null) {
      listener?.(event, session);
    },
  };
}

const createSession = (accessToken: string): Pick<Session, "access_token"> => ({
  access_token: accessToken,
});

describe("createAccessTokenCache", () => {
  it("caches an anonymous session across sequential requests", async () => {
    const { auth } = createAuthMock(null);
    const cache = createAccessTokenCache(auth);

    await expect(cache.getAccessToken()).resolves.toBeUndefined();
    await expect(cache.getAccessToken()).resolves.toBeUndefined();

    expect(auth.getSession).toHaveBeenCalledTimes(1);
  });

  it("reuses the current access token across sequential requests", async () => {
    const { auth } = createAuthMock(createSession("access-token-a"));
    const cache = createAccessTokenCache(auth);

    await expect(cache.getAccessToken()).resolves.toBe("access-token-a");
    await expect(cache.getAccessToken()).resolves.toBe("access-token-a");

    expect(auth.getSession).toHaveBeenCalledTimes(1);
  });

  it("uses a refreshed token for subsequent requests", async () => {
    const { auth, emit } = createAuthMock(createSession("access-token-a"));
    const cache = createAccessTokenCache(auth);
    await expect(cache.getAccessToken()).resolves.toBe("access-token-a");

    emit("TOKEN_REFRESHED", createSession("access-token-b"));

    await expect(cache.getAccessToken()).resolves.toBe("access-token-b");
    expect(auth.getSession).toHaveBeenCalledTimes(1);
  });

  it("clears the cached token after sign-out", async () => {
    const { auth, emit } = createAuthMock(createSession("access-token-a"));
    const cache = createAccessTokenCache(auth);
    await expect(cache.getAccessToken()).resolves.toBe("access-token-a");

    emit("SIGNED_OUT", null);

    await expect(cache.getAccessToken()).resolves.toBeUndefined();
    expect(auth.getSession).toHaveBeenCalledTimes(1);
  });

  it("does not let an initial session read overwrite a newer auth event", async () => {
    let resolveSession:
      | ((value: Awaited<ReturnType<AccessTokenAuthClient["getSession"]>>) => void)
      | undefined;
    const { auth, emit } = createAuthMock(null);
    auth.getSession = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
    );
    const cache = createAccessTokenCache(auth);

    const pending = cache.getAccessToken();
    emit("SIGNED_IN", createSession("new-token"));
    resolveSession?.({ data: { session: createSession("stale-token") } });

    await expect(pending).resolves.toBe("new-token");
    await expect(cache.getAccessToken()).resolves.toBe("new-token");
  });
});
