import {
  createError,
  defineEventHandler,
  getCookie,
  getQuery,
  getRequestURL,
  sendRedirect,
  setCookie,
} from "h3";

const LOCALES = ["en", "fr", "es", "ja"] as const;
type Locale = (typeof LOCALES)[number];

const THEMES = ["system", "dark", "light"] as const;
type Theme = (typeof THEMES)[number];

function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && LOCALES.some((locale) => locale === value);
}

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEMES.some((theme) => theme === value);
}

function aboutPath(locale: Locale, theme?: Theme): string {
  const path = locale === "en" ? "/about" : `/${locale}/about`;
  return theme === "light" ? `${path}.light.html` : path;
}

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const savedThemeCookie = getCookie(event, "dubbingbase-theme");
  const locale = isLocale(query.locale) ? query.locale : undefined;
  const selectedLocale = isLocale(query.lang) ? query.lang : undefined;
  const selectedTheme = isTheme(query.theme) ? query.theme : undefined;
  const savedTheme = isTheme(savedThemeCookie) ? savedThemeCookie : undefined;

  if (
    !locale ||
    (query.lang !== undefined && !selectedLocale) ||
    (query.theme !== undefined && !selectedTheme) ||
    (!selectedLocale && !selectedTheme)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid About preference",
    });
  }

  const requestUrl = getRequestURL(event);
  const cookieOptions = {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax" as const,
    secure: requestUrl.protocol === "https:",
  };

  if (selectedLocale) setCookie(event, "user_lang", selectedLocale, cookieOptions);
  if (selectedTheme) {
    setCookie(event, "dubbingbase-theme", selectedTheme, cookieOptions);
  }

  return sendRedirect(event, aboutPath(selectedLocale ?? locale, selectedTheme ?? savedTheme), 302);
});
