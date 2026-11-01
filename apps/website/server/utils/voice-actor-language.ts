import { APP_LOCALES } from "@app/shared-logic";
import type { H3Event } from "h3";

export function resolveVoiceActorLanguage(event: H3Event): string {
  const query = getQuery(event);
  const rawLanguage = typeof query.lang === "string" ? query.lang.trim() : "";
  const canonicalLanguages = APP_LOCALES.map((locale) => locale.language);
  const shortToCanonical = Object.fromEntries(
    APP_LOCALES.map((locale) => [locale.code, locale.language]),
  );
  const headerLanguage =
    (getHeader(event, "accept-language") || "fr-FR").split(",")[0]?.trim() || "fr-FR";

  return canonicalLanguages.includes(rawLanguage)
    ? rawLanguage
    : shortToCanonical[rawLanguage] || headerLanguage;
}
