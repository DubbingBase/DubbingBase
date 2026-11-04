import { displayDubbingLanguage } from "@app/shared-logic";

/** Locale-aware label for a dubbing language code, shared by every media details page. */
export function useDubbingLanguageLabel() {
  const { locale, t } = useI18n();

  return (langCode: string | undefined | null): string =>
    langCode ? displayDubbingLanguage(langCode, locale.value || "en") : t("details.notSpecified");
}
