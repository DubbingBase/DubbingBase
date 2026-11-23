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
  // A failed lookup is an outage, not a bad credential: let it surface as a 500.
  if (error) throw new Error("API token lookup failed");
  if (!data || data.revoked_at) return null;
  if (data.expires_at && Date.parse(data.expires_at) <= Date.now()) return null;

  // The owner must still exist, not be banned, and still be an admin, so demoting or banning a
  // user silences their tokens immediately without having to revoke each one.
  const { data: owner, error: ownerError } = await supabase.auth.admin.getUserById(data.user_id);
  if (ownerError) {
    if (ownerError.status === 404 || ownerError.code === "user_not_found") return null;
    throw new Error("API token owner lookup failed");
  }
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

/**
 * Fixed-window limiter keyed by an opaque string. State lives in the isolate's memory, so it
 * caps bursts from one client rather than enforcing an exact global quota. The key table is
 * bounded: expired windows are dropped first, then the oldest keys.
 */
function createRateLimiter(limit: number, maxKeys: number, windowMs = 60_000) {
  const windows = new Map<string, { start: number; count: number }>();
  return (key: string, now = Date.now()) => {
    const current = windows.get(key);
    const window = current && now - current.start < windowMs ? current : { start: now, count: 0 };
    window.count += 1;
    windows.set(key, window);
    if (windows.size > maxKeys) {
      for (const [other, value] of windows) {
        if (now - value.start >= windowMs) windows.delete(other);
      }
      for (const other of windows.keys()) {
        if (windows.size <= maxKeys) break;
        windows.delete(other);
      }
    }
    return {
      allowed: window.count <= limit,
      limit,
      remaining: Math.max(limit - window.count, 0),
      retryAfter: Math.max(Math.ceil((window.start + windowMs - now) / 1000), 1),
    };
  };
}

/** Per token, once the token has authenticated. */
export const consumeRateLimit = createRateLimiter(120, 5000);

/**
 * Per client address, before any token lookup, so unknown or revoked token values cannot drive
 * unbounded database queries. Keyed on the address Cloudflare sets, never on the token.
 */
export const consumeIpRateLimit = createRateLimiter(600, 10_000);

export function clientAddress(event: H3Event): string {
  return getHeader(event, "cf-connecting-ip") ?? "unknown";
}
