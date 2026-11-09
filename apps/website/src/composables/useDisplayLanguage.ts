import { displayDubbingLanguage } from "@app/shared-logic";

/** Localized language name for a dubbing language code, in the current UI locale. */
export const useDisplayLanguage = () => {
  const { t, locale } = useI18n();
  return (code: string | null | undefined): string =>
    code ? displayDubbingLanguage(code, locale.value) : t("projectEditor.languageUnknown");
};
