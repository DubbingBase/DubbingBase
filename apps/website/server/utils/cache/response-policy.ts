import {
  getRequestHeader,
  getRequestURL,
  getResponseHeader,
  getResponseStatus,
  removeResponseHeader,
  type H3Event,
} from "h3";
import { setNoCacheHeaders, setPublicCacheHeaders } from "./http";
import { shouldCachePublicPage } from "./public-pages";

export type CacheDecision = "page" | "keep" | "no-store";

export interface CacheDecisionInput {
  method: string;
  pathname: string;
  status: number;
  cookieHeader: string | undefined;
  authorizationHeader: string | undefined;
  supabaseCookiePrefix: string | undefined;
  /** `Cache-Control` already set by the handler, if any. */
  existingCacheControl: string | undefined;
  disablePublicPageCache?: boolean;
  isDev: boolean;
}

/**
 * The single place that decides how a dynamic Nitro response may be cached.
 * Order matters:
 * 1. development and error responses are never cached;
 * 2. handlers that explicitly opted in with `setPublicCacheHeaders` keep it;
 * 3. allow-listed anonymous page renders are shared at the edge;
 * 4. everything else is `no-store`.
 */
export function resolveCacheDecision(input: CacheDecisionInput): CacheDecision {
  if (input.isDev || input.status >= 400 || input.disablePublicPageCache) return "no-store";
  if (input.existingCacheControl?.trimStart().startsWith("public")) return "keep";
  if (shouldCachePublicPage(input)) return "page";
  return "no-store";
}

/**
 * Runs at the start of every request so handlers that send their own response
 * (redirects, streams) are still `no-store` by default. Handlers opt in later
 * with `setPublicCacheHeaders`.
 */
export function applyDefaultCachePolicy(event: H3Event): void {
  setNoCacheHeaders(event);
}

export function applyCachePolicy(
  event: H3Event,
  options: { supabaseCookiePrefix?: string; isDev?: boolean } = {},
): void {
  // Responses already sent by the handler (e.g. redirects) keep the default.
  if (event.node.res.headersSent) return;

  const existing = getResponseHeader(event, "cache-control");
  const decision = resolveCacheDecision({
    method: event.method,
    pathname: getRequestURL(event).pathname,
    status: getResponseStatus(event),
    cookieHeader: getRequestHeader(event, "cookie"),
    authorizationHeader: getRequestHeader(event, "authorization"),
    supabaseCookiePrefix: options.supabaseCookiePrefix,
    existingCacheControl: typeof existing === "string" ? existing : undefined,
    disablePublicPageCache: event.context.disablePublicPageCache === true,
    isDev: options.isDev ?? import.meta.dev,
  });

  if (decision === "page") {
    // Cloudflare does not cache responses that set cookies.
    removeResponseHeader(event, "set-cookie");
    setPublicCacheHeaders(event, "page");
  } else if (decision === "no-store") {
    setNoCacheHeaders(event);
  }
}
