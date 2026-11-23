import { isApiScope, type ApiScope } from "../../../shared/api-scopes";
import { useSupabaseAdmin } from "../db/client";
import { getHeader, type H3Event } from "h3";

export const API_TOKEN_PREFIX = "dbk_live_";
const LAST_USED_REFRESH_MS = 5 * 60 * 1000;

export interface ApiPrincipal {
  tokenId: string;
  userId: string;
  scopes: ApiScope[];
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashApiToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** 256 random bits behind a recognizable prefix, so secret scanners can flag a leaked token. */
export async function generateApiToken() {
  const token = `${API_TOKEN_PREFIX}${base64Url(crypto.getRandomValues(new Uint8Array(32)))}`;
  return { token, prefix: token.slice(0, 14), hash: await hashApiToken(token) };
}

export function readBearerToken(event: H3Event): string | null {
  const header = getHeader(event, "authorization");
  const match = header ? /^Bearer\s+(\S+)$/i.exec(header) : null;
  return match?.[1]?.startsWith(API_TOKEN_PREFIX) ? match[1] : null;
}

/**
 * Resolves a bearer token to its owner and scopes, or `null` when it is unknown, revoked or
 * expired, or when its owner is no longer an active admin.
 */
export async function authenticateApiToken(
  event: H3Event,
  token: string,
): Promise<ApiPrincipal | null> {
  const supabase = useSupabaseAdmin(event);
  const { data, error } = await supabase
    .from("api_tokens")
    .select("id, user_id, scopes, expires_at, revoked_at, last_used_at")
    .eq("token_hash", await hashApiToken(token))
    .maybeSingle();
  if (error || !data || data.revoked_at) return null;
  if (data.expires_at && Date.parse(data.expires_at) <= Date.now()) return null;

  // The owner must still exist, not be banned, and still be an admin, so demoting or banning a
  // user silences their tokens immediately without having to revoke each one.
  const { data: owner } = await supabase.auth.admin.getUserById(data.user_id);
  const banned = owner.user?.banned_until
    ? Date.parse(owner.user.banned_until) > Date.now()
    : false;
  if (!owner.user || banned || owner.user.app_metadata?.role !== "admin") return null;
  const scopes = data.scopes.filter(isApiScope);

  const lastUsed = data.last_used_at ? Date.parse(data.last_used_at) : 0;
  if (Date.now() - lastUsed > LAST_USED_REFRESH_MS) {
    await supabase
      .from("api_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);
  }
  return { tokenId: data.id, userId: data.user_id, scopes };
}

const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;
const windows = new Map<string, { start: number; count: number }>();

/**
 * Fixed-window limit per token. State lives in the isolate's memory, so it caps bursts from
 * one client rather than enforcing an exact global quota.
 */
export function consumeRateLimit(tokenId: string, now = Date.now()) {
  const current = windows.get(tokenId);
  const window =
    current && now - current.start < RATE_WINDOW_MS ? current : { start: now, count: 0 };
  window.count += 1;
  windows.set(tokenId, window);
  if (windows.size > 5000) {
    for (const [key, value] of windows)
      if (now - value.start >= RATE_WINDOW_MS) windows.delete(key);
  }
  return {
    allowed: window.count <= RATE_LIMIT,
    limit: RATE_LIMIT,
    remaining: Math.max(RATE_LIMIT - window.count, 0),
    retryAfter: Math.max(Math.ceil((window.start + RATE_WINDOW_MS - now) / 1000), 1),
  };
}
