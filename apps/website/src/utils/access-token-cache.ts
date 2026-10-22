import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

type AccessTokenSession = Pick<Session, "access_token">;

export interface AccessTokenAuthClient {
  getSession: () => Promise<{ data: { session: AccessTokenSession | null } }>;
  onAuthStateChange: (
    callback: (event: AuthChangeEvent, session: AccessTokenSession | null) => void,
  ) => { data: { subscription: { unsubscribe: () => void } } };
}

/**
 * Keep the current browser access token in sync with Supabase auth events.
 * `getSession` is only needed once when no auth event has populated the cache.
 */
export function createAccessTokenCache(auth: AccessTokenAuthClient) {
  let cachedAccessToken: string | undefined;
  let cacheReady = false;
  let pendingAccessToken: Promise<string | undefined> | undefined;
  let authRevision = 0;

  auth.onAuthStateChange((event, session) => {
    authRevision += 1;
    cacheReady = true;
    cachedAccessToken = event === "SIGNED_OUT" ? undefined : session?.access_token;
  });

  return {
    getAccessToken(): Promise<string | undefined> {
      if (cacheReady) return Promise.resolve(cachedAccessToken);
      if (pendingAccessToken) return pendingAccessToken;

      const requestRevision = authRevision;
      pendingAccessToken = auth
        .getSession()
        .then(({ data: { session } }) => {
          if (authRevision === requestRevision) {
            cachedAccessToken = session?.access_token;
            cacheReady = true;
          }
          return cachedAccessToken;
        })
        .catch(() => cachedAccessToken)
        .finally(() => {
          pendingAccessToken = undefined;
        });

      return pendingAccessToken;
    },
  };
}
