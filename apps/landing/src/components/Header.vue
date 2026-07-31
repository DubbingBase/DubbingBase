<template>
  <header
    class="flex justify-between items-center mb-6 md:mb-12 py-4 px-4 md:py-6 md:px-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-[#121212] transition-colors"
  >
    <NuxtLink
      :to="$localePath('/')"
      class="text-2xl md:text-3xl font-extrabold bg-gradient-to-r from-gray-900 to-gray-500 dark:from-white dark:to-gray-400 bg-clip-text text-transparent"
    >
      {{ t("app.title") }}
    </NuxtLink>

    <nav class="flex items-center gap-2 md:gap-4">
      <NuxtLink
        :to="$localePath('/')"
        class="hidden sm:block text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition text-sm"
        >{{ t("nav.home") }}</NuxtLink
      >

      <button
        @click="isSearchOpen = true"
        class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition text-sm bg-gray-100 dark:bg-gray-800/50 hover:bg-gray-200 dark:hover:bg-gray-800 px-2.5 py-1.5 md:px-3 rounded-full border border-gray-300 dark:border-gray-700"
        :aria-label="t('search.placeholder')"
      >
        <SearchIcon class="w-4 h-4" />
        <span class="hidden sm:inline">{{
          t("search.placeholder") || "Search..."
        }}</span>
        <kbd
          class="hidden sm:inline-flex items-center justify-center w-5 h-5 ml-2 text-xs font-bold bg-gray-200 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300"
        >
          /
        </kbd>
      </button>

      <NuxtLink
        :to="$localePath('/login')"
        class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition text-sm"
        :aria-label="t('nav.login')"
      >
        <UserIcon class="w-5 h-5 md:w-4 md:h-4" />
        <span class="hidden sm:inline">{{ t("nav.login") }}</span>
      </NuxtLink>

      <SelectRoot v-model="theme">
        <SelectTrigger
          class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition text-sm bg-transparent border-none cursor-pointer"
        >
          <SunIcon v-if="theme === 'light'" class="w-4 h-4" />
          <MoonIcon v-else-if="theme === 'dark'" class="w-4 h-4" />
          <MonitorIcon v-else class="w-4 h-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectPortal>
          <SelectContent
            position="popper"
            class="z-50 bg-white dark:bg-[#1d1d1d] border border-gray-200 dark:border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden min-w-[140px] text-gray-800 dark:text-gray-200"
            :sideOffset="5"
          >
            <SelectViewport class="p-1">
              <SelectItem
                value="light"
                class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#2a2a2a] cursor-pointer outline-none rounded-md data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-[#2a2a2a] data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-white"
              >
                <SunIcon class="w-4 h-4" />
                <SelectItemText>{{ t("theme.light") }}</SelectItemText>
              </SelectItem>
              <SelectItem
                value="dark"
                class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#2a2a2a] cursor-pointer outline-none rounded-md data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-[#2a2a2a] data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-white"
              >
                <MoonIcon class="w-4 h-4" />
                <SelectItemText>{{ t("theme.dark") }}</SelectItemText>
              </SelectItem>
              <SelectItem
                value="system"
                class="flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#2a2a2a] cursor-pointer outline-none rounded-md data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-[#2a2a2a] data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-white"
              >
                <MonitorIcon class="w-4 h-4" />
                <SelectItemText>{{ t("theme.system") }}</SelectItemText>
              </SelectItem>
            </SelectViewport>
          </SelectContent>
        </SelectPortal>
      </SelectRoot>

      <SelectRoot :modelValue="locale" @update:modelValue="setLocale">
        <SelectTrigger
          class="flex items-center gap-1.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition text-sm bg-transparent border-none cursor-pointer"
        >
          <GlobeIcon class="w-4 h-4" />
          <SelectValue />
        </SelectTrigger>
        <SelectPortal>
          <SelectContent
            position="popper"
            class="z-50 bg-white dark:bg-[#1d1d1d] border border-gray-200 dark:border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden min-w-[120px] text-gray-800 dark:text-gray-200"
            :sideOffset="5"
          >
            <SelectViewport class="p-1">
              <SelectItem
                value="en"
                class="flex items-center px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#2a2a2a] cursor-pointer outline-none rounded-md data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-[#2a2a2a] data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-white"
                ><SelectItemText>{{
                  t("language.en")
                }}</SelectItemText></SelectItem
              >
              <SelectItem
                value="fr"
                class="flex items-center px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-[#2a2a2a] cursor-pointer outline-none rounded-md data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-[#2a2a2a] data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-white"
                ><SelectItemText>{{
                  t("language.fr")
                }}</SelectItemText></SelectItem
              >
            </SelectViewport>
          </SelectContent>
        </SelectPortal>
      </SelectRoot>
    </nav>
    <SearchModal v-model:open="isSearchOpen" />
  </header>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useTheme } from "../composables/useTheme";
import { useSearchModal } from "../composables/useSearchModal";
import {
  SunIcon,
  MoonIcon,
  UserIcon,
  GlobeIcon,
  MonitorIcon,
  SearchIcon,
} from "lucide-vue-next";
import SearchModal from "./SearchModal.vue";
import {
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectPortal,
  SelectViewport,
  SelectItemText,
} from "reka-ui";

const { theme } = useTheme();
const { t, locale } = useI18n();
const { isSearchOpen } = useSearchModal();
</script>
