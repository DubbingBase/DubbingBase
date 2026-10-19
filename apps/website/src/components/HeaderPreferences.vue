<template>
  <div
    class="relative flex items-center justify-center w-10 h-10 rounded-full theme-text-secondary theme-hover-text theme-hover-surface-muted transition-colors"
  >
    <SunIcon v-if="theme === 'light'" :size="20" aria-hidden="true" />
    <MoonIcon v-else-if="theme === 'dark'" :size="20" aria-hidden="true" />
    <MonitorIcon v-else :size="20" aria-hidden="true" />
    <select
      v-model="theme"
      aria-label="Toggle theme"
      class="absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-color-border-strong)]"
    >
      <option value="system">{{ t("theme.system") }}</option>
      <option value="dark">{{ t("theme.dark") }}</option>
      <option value="light">{{ t("theme.light") }}</option>
    </select>
  </div>

  <div
    class="relative flex items-center justify-center w-10 h-10 rounded-full theme-text-secondary theme-hover-text theme-hover-surface-muted transition-colors"
  >
    <GlobeIcon :size="20" aria-hidden="true" />
    <select
      :value="locale"
      aria-label="Toggle language"
      class="absolute inset-0 h-full w-full cursor-pointer rounded-full opacity-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-color-border-strong)]"
      @change="setLocale"
    >
      <option
        v-for="supportedLocale in SUPPORTED_LOCALES"
        :key="supportedLocale"
        :value="supportedLocale"
      >
        {{ t(`language.${supportedLocale}`) }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
import { SUPPORTED_LOCALES } from "@app/shared-logic";
import { GlobeIcon, MoonIcon, MonitorIcon, SunIcon } from "lucide-vue-next";
import { useTheme } from "../composables/useTheme";

const { theme } = useTheme();
const { t, locale } = useI18n();
const switchLocalePath = useSwitchLocalePath();

const setLocale = (event: Event): void => {
  const target = event.currentTarget;
  if (!(target instanceof HTMLSelectElement)) return;

  const nextLocale = SUPPORTED_LOCALES.find((supportedLocale) => supportedLocale === target.value);
  if (!nextLocale) return;

  void navigateTo(switchLocalePath(nextLocale));
};
</script>
