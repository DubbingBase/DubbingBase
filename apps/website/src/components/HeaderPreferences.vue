<template>
  <template v-if="!selectorsReady">
    <button
      type="button"
      class="flex items-center justify-center w-10 h-10 theme-text-secondary theme-hover-text theme-hover-surface-muted rounded-full transition-colors bg-transparent border-none cursor-pointer outline-none"
      aria-label="Toggle theme"
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded="false"
      data-preference-trigger
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
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded="false"
      data-preference-trigger
      @click="openPreference('language')"
      @keydown="onPreferenceKeydown($event, 'language')"
    >
      <GlobeIcon :size="20" />
    </button>
  </template>
  <component
    :is="HeaderPreferenceSelects"
    v-if="openedPreference"
    :initial-open="openedPreference"
    @ready="onSelectorsReady"
  />
</template>

<script setup lang="ts">
import { GlobeIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-vue-next";
import { defineAsyncComponent, onBeforeUnmount, ref } from "vue";
import { useTheme } from "../composables/useTheme";

type PreferenceMenu = "theme" | "language";

const { theme } = useTheme();
const openedPreference = ref<PreferenceMenu | null>(null);
const selectorsReady = ref(false);

const removePendingOpenListeners = (): void => {
  document.removeEventListener("keydown", onPendingKeydown);
  document.removeEventListener("pointerdown", onOutsidePointerdown);
};

const cancelPendingOpen = (): void => {
  if (!openedPreference.value || selectorsReady.value) return;
  openedPreference.value = null;
  removePendingOpenListeners();
};

const onPendingKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Escape" || event.key === "Tab") cancelPendingOpen();
};

const onOutsidePointerdown = (event: PointerEvent): void => {
  const target = event.target;
  if (target instanceof Element && target.closest("[data-preference-trigger]")) return;
  cancelPendingOpen();
};

const HeaderPreferenceSelects = defineAsyncComponent({
  loader: () => import("./HeaderPreferenceSelects.vue"),
  onError(_error, _retry, fail) {
    removePendingOpenListeners();
    openedPreference.value = null;
    selectorsReady.value = false;
    fail();
  },
});

const openPreference = (preference: PreferenceMenu): void => {
  openedPreference.value = preference;
  document.addEventListener("keydown", onPendingKeydown);
  document.addEventListener("pointerdown", onOutsidePointerdown);
};

const onPreferenceKeydown = (event: KeyboardEvent, preference: PreferenceMenu): void => {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  event.preventDefault();
  openPreference(preference);
};

const onSelectorsReady = (): void => {
  if (!openedPreference.value) {
    removePendingOpenListeners();
    return;
  }
  selectorsReady.value = true;
  removePendingOpenListeners();
};

onBeforeUnmount(removePendingOpenListeners);
</script>
