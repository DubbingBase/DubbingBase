import { useLocalStorage } from '@vueuse/core'
import { readonly } from 'vue'

/**
 * Composable for managing language preferences
 * Uses VueUse's useLocalStorage to persist the preferred language
 * Defaults to browser language if not set
 */
export function useLanguagePreference() {
  // Get browser language as default (first 2 characters for language code)
  const getBrowserLanguage = (): string => {
    const browserLang = navigator.language || 'en'
    return browserLang.split('-')[0] // Get 'en' from 'en-US', 'fr' from 'fr-FR', etc.
  }

  // Use useLocalStorage with browser language as default
  const preferredLanguage = useLocalStorage<string>('preferred-language', getBrowserLanguage())

  // Function to set new language
  const setLanguage = (newLanguage: string): void => {
    preferredLanguage.value = newLanguage
  }

  return {
    preferredLanguage: readonly(preferredLanguage),
    setLanguage
  }
}
