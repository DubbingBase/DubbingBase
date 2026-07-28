import { createI18n } from 'vue-i18n';
import en from './en.json';
import fr from './fr.json';

const getBrowserLocale = (): string => {
  if (typeof navigator === 'undefined') return 'en';
  const browserLang = navigator.language.split('-')[0];
  if (browserLang === 'fr') return 'fr';
  return 'en';
};

export const i18n = createI18n({
  legacy: false,
  locale: getBrowserLocale(),
  fallbackLocale: 'en',
  messages: { en, fr },
});