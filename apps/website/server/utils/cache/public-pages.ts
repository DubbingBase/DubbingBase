import { APP_LOCALES } from "@app/shared-logic";
import { hasSupabaseAuthCookie } from "../auth-session";

const LOCALE_PREFIXES = new Set(APP_LOCALES.map((locale) => `/${locale.code}`));

// Pages whose server-rendered HTML is identical for every visitor. Per-user UI
// (admin links, avatar, theme) is applied on the client after hydration.
// "/" is cacheable because the server never redirects it by Accept-Language
// or cookie; LanguageBanner only suggests a language on the client.
const STATIC_PUBLIC_PAGES = new Set(["/", "/movies", "/series", "/voice-actors"]);
const PUBLIC_DETAIL_PAGE =
  /^\/(?:(?:movie|show|voice-actor|actor|game)\/\d+|show\/\d+\/season\/\d+(?:\/episode\/\d+)?)$/;

function stripLocalePrefix(pathname: string): string {
  const [, first = ""] = pathname.split("/");
  const prefix = `/${first}`;
  if (!LOCALE_PREFIXES.has(prefix)) return pathname;
  return pathname.slice(prefix.length) || "/";
}

export function isPublicCacheablePage(pathname: string): boolean {
  const path = stripLocalePrefix(pathname.replace(/\/+$/, "") || "/");
  return STATIC_PUBLIC_PAGES.has(path) || PUBLIC_DETAIL_PAGE.test(path);
}

export interface PublicPageRequest {
  method: string;
  pathname: string;
  status: number;
  cookieHeader: string | undefined;
  authorizationHeader: string | undefined;
  supabaseCookiePrefix: string | undefined;
}

/**
 * A response may be shared across visitors only for successful anonymous GETs
 * of allow-listed pages. Signed-in requests never populate the shared cache.
 */
export function shouldCachePublicPage(request: PublicPageRequest): boolean {
  return (
    request.method === "GET" &&
    request.status === 200 &&
    !request.authorizationHeader &&
    !hasSupabaseAuthCookie(request.cookieHeader, request.supabaseCookiePrefix) &&
    isPublicCacheablePage(request.pathname)
  );
}
