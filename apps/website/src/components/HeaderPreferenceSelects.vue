<template>
  <SelectRoot v-model="theme" v-model:open="themeOpen">
    <SelectTrigger
      class="flex items-center justify-center w-10 h-10 theme-text-secondary theme-hover-text theme-hover-surface-muted rounded-full transition-colors bg-transparent border-none cursor-pointer outline-none"
      aria-label="Toggle theme"
    >
      <SunIcon v-if="theme === 'light'" :size="20" />
      <MoonIcon v-else-if="theme === 'dark'" :size="20" />
      <MonitorIcon v-else :size="20" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        class="z-50 theme-surface-overlay backdrop-blur-md border theme-border rounded-xl shadow-xl overflow-hidden min-w-[140px] theme-text"
        :sideOffset="8"
      >
        <SelectViewport class="p-1.5">
          <SelectItem
            value="light"
            class="flex items-center gap-2.5 px-3 py-2 text-sm font-medium theme-hover-surface-muted cursor-pointer outline-none rounded-lg data-[highlighted]:bg-[var(--app-color-surface-muted)] data-[highlighted]:text-[var(--app-color-text)] transition-colors"
          >
            <SunIcon :size="16" />
            <SelectItemText>{{ t("theme.light") }}</SelectItemText>
          </SelectItem>
          <SelectItem
            value="dark"
            class="flex items-center gap-2.5 px-3 py-2 text-sm font-medium theme-hover-surface-muted cursor-pointer outline-none rounded-lg data-[highlighted]:bg-[var(--app-color-surface-muted)] data-[highlighted]:text-[var(--app-color-text)] transition-colors"
          >
            <MoonIcon :size="16" />
            <SelectItemText>{{ t("theme.dark") }}</SelectItemText>
          </SelectItem>
          <SelectItem
            value="system"
            class="flex items-center gap-2.5 px-3 py-2 text-sm font-medium theme-hover-surface-muted cursor-pointer outline-none rounded-lg data-[highlighted]:bg-[var(--app-color-surface-muted)] data-[highlighted]:text-[var(--app-color-text)] transition-colors"
          >
            <MonitorIcon :size="16" />
            <SelectItemText>{{ t("theme.system") }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>

  <SelectRoot :modelValue="locale" v-model:open="languageOpen" @update:modelValue="setLocale">
    <SelectTrigger
      class="flex items-center justify-center w-10 h-10 theme-text-secondary theme-hover-text theme-hover-surface-muted rounded-full transition-colors bg-transparent border-none cursor-pointer outline-none"
      aria-label="Toggle language"
    >
      <GlobeIcon :size="20" />
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        class="z-50 theme-surface-overlay backdrop-blur-md border theme-border rounded-xl shadow-xl overflow-hidden min-w-[140px] theme-text"
        :sideOffset="8"
      >
        <SelectViewport class="p-1.5">
          <SelectItem
            v-for="language in SUPPORTED_LOCALES"
            :key="language"
            :value="language"
            class="flex items-center px-3 py-2 text-sm font-medium theme-hover-surface-muted cursor-pointer outline-none rounded-lg data-[highlighted]:bg-[var(--app-color-surface-muted)] data-[highlighted]:text-[var(--app-color-text)] transition-colors"
          >
            <SelectItemText>{{ t(`language.${language}`) }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>

<script setup lang="ts">
import { SUPPORTED_LOCALES, type SupportedLocale } from "@app/shared-logic";
import { GlobeIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-vue-next";
import {
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport,
} from "reka-ui";
import { ref } from "vue";
import { useTheme } from "../composables/useTheme";

const props = defineProps<{ initialOpen: "theme" | "language" }>();

const { theme } = useTheme();
const { t, locale } = useI18n();
const switchLocalePath = useSwitchLocalePath();
const themeOpen = ref(props.initialOpen === "theme");
const languageOpen = ref(props.initialOpen === "language");

const setLocale = (value: SupportedLocale): void => {
  void navigateTo(switchLocalePath(value));
};
</script>
