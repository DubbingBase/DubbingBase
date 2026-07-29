import { watch } from "vue";
import { useI18n as useVueI18n } from "vue-i18n";
import { useLocalStorage } from "@vueuse/core";

const supportedLocales = ["en", "fr"] as const;
type Locale = (typeof supportedLocales)[number];

const isLocale = (lang: string): lang is Locale =>
  lang === "en" || lang === "fr";

const getBrowserLocale = (): Locale => {
  if (typeof navigator === "undefined") return "en";
  const browserLang = navigator.language.split("-")[0];
  if (isLocale(browserLang)) return browserLang;
  return "en";
};

export function useI18n() {
  const { t, locale } = useVueI18n();

  const storedLocale = useLocalStorage<Locale>(
    "dubbingbase-locale",
    getBrowserLocale(),
  );

  if (storedLocale.value !== locale.value) {
    locale.value = storedLocale.value;
  }

  watch(locale, (newLocale) => {
    if (isLocale(newLocale)) {
      storedLocale.value = newLocale;
    }
  });

  watch(storedLocale, (newLocale) => {
    locale.value = newLocale;
  });

  return { t, locale };
}
