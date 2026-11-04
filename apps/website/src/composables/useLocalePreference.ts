import type { SupportedLocale } from "@app/shared-logic";
import { LOCALE_PREFERENCE_COOKIE, resolvePreferredLocale } from "../utils/locale-preference";

/**
 * Browser-only language preference. The server never reads or writes the
 * cookie, so server-rendered HTML stays identical for every visitor and can be
 * cached at the edge.
 */
export function useLocalePreference() {
  function getPreferredLocale(): SupportedLocale | null {
    if (!import.meta.client) return null;
    const saved = useCookie<string | null>(LOCALE_PREFERENCE_COOKIE).value;
    return resolvePreferredLocale(saved, navigator.languages ?? [navigator.language]);
  }

  /** Records an explicit language choice (switcher or banner). */
  function rememberLocale(code: SupportedLocale): void {
    if (!import.meta.client) return;
    useCookie<string | null>(LOCALE_PREFERENCE_COOKIE, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    }).value = code;
  }

  return { getPreferredLocale, rememberLocale };
}
