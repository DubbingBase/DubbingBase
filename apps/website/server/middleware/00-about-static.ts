import {
  defineEventHandler,
  getCookie,
  getHeader,
  getRequestURL,
  sendRedirect,
  sendWebResponse,
  setCookie,
  toWebRequest,
  type H3Event,
} from "h3";
import { hasSupabaseAuthCookie } from "../utils/auth-session";

const LOCALES = ["en", "fr", "es", "ja"] as const;
type Locale = (typeof LOCALES)[number];

const ABOUT_ROUTES: Record<string, Locale> = {
  "/about": "en",
  "/about/": "en",
  "/fr/about": "fr",
  "/fr/about/": "fr",
  "/es/about": "es",
  "/es/about/": "es",
  "/ja/about": "ja",
  "/ja/about/": "ja",
};
const THEME_PREFERENCES = ["system", "dark", "light"] as const;
type ThemePreference = (typeof THEME_PREFERENCES)[number];

interface StaticAssetsBinding {
  fetch(request: Request): Promise<Response>;
}

function readProperty(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return Reflect.get(value, key);
}

function isStaticAssetsBinding(value: unknown): value is StaticAssetsBinding {
  if (
    typeof value !== "object" ||
    value === null ||
    typeof readProperty(value, "fetch") !== "function"
  ) {
    return false;
  }

  return true;
}

function getStaticAssets(event: H3Event): StaticAssetsBinding | undefined {
  const cloudflare = readProperty(event.context, "cloudflare");
  const env = readProperty(cloudflare, "env");
  const assets = readProperty(env, "ASSETS");
  if (!isStaticAssetsBinding(assets)) return undefined;
  return assets;
}

function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && LOCALES.some((locale) => locale === value);
}

function isThemePreference(value: string | undefined): value is ThemePreference {
  return value !== undefined && THEME_PREFERENCES.some((theme) => theme === value);
}

function aboutPathForLocale(locale: Locale): string {
  return locale === "en" ? "/about" : `/${locale}/about`;
}

export default defineEventHandler(async (event) => {
  if (event.method !== "GET" || !getHeader(event, "accept")?.includes("text/html")) {
    return;
  }

  const url = getRequestURL(event);
  const routeLocale = ABOUT_ROUTES[url.pathname];
  if (!routeLocale) return;

  const selectedLocale = url.searchParams.get("lang") ?? undefined;
  const selectedTheme = url.searchParams.get("theme") ?? undefined;
  const validLocale = isLocale(selectedLocale) ? selectedLocale : undefined;
  const validTheme = isThemePreference(selectedTheme) ? selectedTheme : undefined;

  if (validLocale || validTheme) {
    const cookieOptions = {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax" as const,
      secure: url.protocol === "https:",
    };

    if (validLocale) setCookie(event, "user_lang", validLocale, cookieOptions);
    if (validTheme) {
      setCookie(event, "dubbingbase-theme", validTheme, cookieOptions);
    }

    url.pathname = aboutPathForLocale(validLocale ?? routeLocale);
    if (validLocale) url.searchParams.delete("lang");
    if (validTheme) url.searchParams.delete("theme");
    return sendRedirect(event, `${url.pathname}${url.search}`, 302);
  }

  const preferredLocale = getCookie(event, "user_lang");
  if (isLocale(preferredLocale) && preferredLocale !== routeLocale) {
    const targetPrefix = preferredLocale === "en" ? "" : `/${preferredLocale}`;
    return sendRedirect(event, `${targetPrefix}/about${url.search}`, 302);
  }

  const canonicalPath = aboutPathForLocale(routeLocale);
  if (url.pathname !== canonicalPath) {
    return sendRedirect(event, `${canonicalPath}${url.search}`, 308);
  }

  const config = useRuntimeConfig(event);
  const preferredTheme = getCookie(event, "dubbingbase-theme");
  if (
    getHeader(event, "authorization") ||
    hasSupabaseAuthCookie(getHeader(event, "cookie"), config.public.supabase.cookiePrefix) ||
    preferredTheme === "system"
  ) {
    return;
  }

  const assets = getStaticAssets(event);
  if (!assets) return;

  try {
    const request = toWebRequest(event);
    const assetPath =
      preferredTheme === "light" ? `${canonicalPath}.light.html` : `${canonicalPath}/`;
    const assetUrl = new URL(assetPath, url.origin);
    assetUrl.search = url.search;
    const response = await assets.fetch(
      new Request(assetUrl, {
        method: request.method,
        headers: request.headers,
      }),
    );
    if (response.status === 404) return;
    return sendWebResponse(event, response);
  } catch {
    // Fall back to SSR when the static asset binding is unavailable.
  }
});
