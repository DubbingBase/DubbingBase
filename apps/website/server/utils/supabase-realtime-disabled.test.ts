// @vitest-environment node

import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

interface TestUser {
  id: string;
  aud: string;
  role: string;
  email: string;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  created_at: string;
}

interface TestSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  user: TestUser;
}

const user: TestUser = {
  id: "user-1",
  aud: "authenticated",
  role: "authenticated",
  email: "test@example.com",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
};

const session = (accessToken: string, refreshToken: string): TestSession => ({
  access_token: accessToken,
  refresh_token: refreshToken,
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user,
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("Supabase client with Realtime omitted", () => {
  it("creates a client, signs in, refreshes its session, and authorizes PostgREST requests", async () => {
    const requests: Array<{ url: string; authorization: string | null; body: string | null }> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      requests.push({
        url,
        authorization: headers.get("authorization"),
        body: typeof init?.body === "string" ? init.body : null,
      });

      if (url.includes("/auth/v1/token?grant_type=password")) {
        return jsonResponse(session("access-1", "refresh-1"));
      }
      if (url.includes("/auth/v1/token?grant_type=refresh_token")) {
        return jsonResponse(session("access-2", "refresh-2"));
      }
      if (url.includes("/auth/v1/logout?scope=local")) {
        return new Response(null, { status: 204 });
      }
      if (url.includes("/rest/v1/profiles")) {
        return jsonResponse({ id: 1 });
      }
      return jsonResponse({ message: `Unexpected test request: ${url}` }, 500);
    };

    const client = createClient("https://example.supabase.co", "publishable-key", {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: { fetch: fetchMock },
    });
    expect((await client.auth.getSession()).data.session).toBeNull();

    const authEvents: string[] = [];
    const { data: listener } = client.auth.onAuthStateChange((event) => {
      authEvents.push(event);
    });

    const signedIn = await client.auth.signInWithPassword({
      email: "test@example.com",
      password: "test-password",
    });
    expect(signedIn.error).toBeNull();
    expect(signedIn.data.session?.access_token).toBe("access-1");
    expect((await client.auth.getSession()).data.session?.refresh_token).toBe("refresh-1");

    const refreshed = await client.auth.refreshSession();
    expect(refreshed.error).toBeNull();
    expect(refreshed.data.session?.access_token).toBe("access-2");

    const profile = await client.from("profiles").select("id").eq("id", 1).single();
    expect(profile.error).toBeNull();
    expect(profile.data).toEqual({ id: 1 });

    expect(requests.map(({ url }) => new URL(url).pathname)).toEqual([
      "/auth/v1/token",
      "/auth/v1/token",
      "/rest/v1/profiles",
    ]);
    expect(requests[0]?.body).toContain("test-password");
    expect(requests[1]?.body).toContain("refresh-1");
    expect(requests[2]?.authorization).toBe("Bearer access-2");
    expect(authEvents).toContain("SIGNED_IN");
    expect(authEvents).toContain("TOKEN_REFRESHED");

    const signedOut = await client.auth.signOut({ scope: "local" });
    expect(signedOut.error).toBeNull();
    expect((await client.auth.getSession()).data.session).toBeNull();
    expect(authEvents).toContain("SIGNED_OUT");
    expect(requests.at(-1)?.url).toContain("/auth/v1/logout?scope=local");

    listener.subscription.unsubscribe();
  });

  it("fails clearly if a caller tries to open a Realtime channel", () => {
    const client = createClient("https://example.supabase.co", "publishable-key", {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    expect(() => client.channel("unsupported")).toThrow(
      "Supabase Realtime is disabled in this website build",
    );
  });
});
