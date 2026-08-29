import { createI18n } from "vue-i18n";
import { fr, en, es, ja } from "@app/locales";
import { DEFAULT_LOCALE } from "@app/shared-logic";

const messages = {
  fr,
  en,
  es,
  ja,
};

const i18n = createI18n({
  locale: "fr",
  fallbackLocale: DEFAULT_LOCALE,
  messages,
  legacy: false,
  globalInjection: true,
});

export default i18n;
