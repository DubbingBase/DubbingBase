import { SUPPORTED_LOCALES, type SupportedLocale } from "@app/shared-logic";

export const LOCALE_PREFERENCE_COOKIE = "user_lang";

function toSupportedCode(value: string | null | undefined): SupportedLocale | null {
  const code = value?.trim().toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_LOCALES.find((locale) => locale === code) ?? null;
}

/**
 * The language a visitor would prefer: an explicit choice (saved in the
 * `user_lang` cookie) wins over the browser language list. It only drives a
 * suggestion banner and never redirects.
 */
export function resolvePreferredLocale(
  savedChoice: string | null | undefined,
  browserLanguages: readonly string[],
): SupportedLocale | null {
  const saved = toSupportedCode(savedChoice);
  if (saved) return saved;

  for (const language of browserLanguages) {
    const code = toSupportedCode(language);
    if (code) return code;
  }
  return null;
}
