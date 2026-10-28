<template>
  <template v-if="!openedPreference">
    <button
      type="button"
      class="flex items-center justify-center w-10 h-10 theme-text-secondary theme-hover-text theme-hover-surface-muted rounded-full transition-colors bg-transparent border-none cursor-pointer outline-none"
      aria-label="Toggle theme"
      @click="openPreference('theme')"
      @keydown="onPreferenceKeydown($event, 'theme')"
    >
      <SunIcon v-if="theme === 'light'" :size="20" />
      <MoonIcon v-else-if="theme === 'dark'" :size="20" />
      <MonitorIcon v-else :size="20" />
    </button>
    <button
      type="button"
      class="flex items-center justify-center w-10 h-10 theme-text-secondary theme-hover-text theme-hover-surface-muted rounded-full transition-colors bg-transparent border-none cursor-pointer outline-none"
      aria-label="Toggle language"
      @click="openPreference('language')"
      @keydown="onPreferenceKeydown($event, 'language')"
    >
      <GlobeIcon :size="20" />
    </button>
  </template>
  <component :is="HeaderPreferenceSelects" v-else :initial-open="openedPreference" />
</template>

<script setup lang="ts">
import { GlobeIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-vue-next";
import { defineAsyncComponent, ref } from "vue";
import { useTheme } from "../composables/useTheme";

type PreferenceMenu = "theme" | "language";

const HeaderPreferenceSelects = defineAsyncComponent(
  () => import("./HeaderPreferenceSelects.vue"),
);

const { theme } = useTheme();
const openedPreference = ref<PreferenceMenu | null>(null);

const openPreference = (preference: PreferenceMenu): void => {
  openedPreference.value = preference;
};

const onPreferenceKeydown = (event: KeyboardEvent, preference: PreferenceMenu): void => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  openPreference(preference);
};
</script>
