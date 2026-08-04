<template>
  <header
    class="sticky top-0 z-50 flex items-center justify-between h-[68px] px-4 md:px-6 border-b border-gray-200/50 dark:border-[#2a2a2a]/50 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-xl transition-colors"
  >
    <!-- Left Section: Logo & Nav -->
    <div class="flex items-center gap-6 w-full sm:w-auto sm:flex-none">
      <NuxtLink
        :to="$localePath('/')"
        class="flex items-center gap-3 group shrink-0"
      >
        <div class="w-9 h-9 rounded-xl overflow-hidden shadow-sm ring-1 ring-black/5 dark:ring-white/10 group-hover:shadow-md transition-all">
          <img src="/apple-touch-icon.png" alt="Logo" class="w-full h-full object-cover" />
        </div>
        <span class="text-xl font-bold tracking-tight text-gray-900 dark:text-white hidden sm:block">
          {{ t("app.title") }}
        </span>
      </NuxtLink>

      <nav class="hidden md:flex items-center gap-1 ml-2">
        <NuxtLink
          :to="$localePath('/')"
          class="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
        >
          {{ t("nav.home") }}
        </NuxtLink>
        <NuxtLink
          v-if="user && isAdmin"
          :to="$localePath('/admin')"
          class="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-all"
        >
          Admin
        </NuxtLink>
      </nav>
    </div>

    <!-- Center Section: Search -->
    <div v-if="!isHomePage" class="flex-1 max-w-md mx-4 hidden sm:flex justify-center">
      <button
        @click="isSearchOpen = true"
        class="group flex items-center justify-between w-full max-w-[320px] h-10 px-4 text-sm text-gray-500 dark:text-gray-400 bg-gray-100/50 dark:bg-gray-800/40 hover:bg-gray-200/50 dark:hover:bg-gray-800/80 border border-transparent hover:border-gray-300/50 dark:hover:border-gray-700/50 rounded-full transition-all shadow-sm hover:shadow-md"
        :aria-label="t('search.placeholder')"
      >
        <div class="flex items-center gap-2">
          <SearchIcon class="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" />
          <span>{{ t("search.placeholder") || "Search..." }}</span>
        </div>
        <kbd class="hidden md:inline-flex items-center justify-center w-5 h-5 text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded transition-opacity">
          /
        </kbd>
      </button>
    </div>

    <!-- Right Section: Actions & Profile -->
    <div class="flex items-center gap-1 md:gap-2 ml-auto shrink-0">
      <!-- Mobile Search Trigger -->
      <button
        v-if="!isHomePage"
        @click="isSearchOpen = true"
        class="sm:hidden flex items-center justify-center w-10 h-10 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
      >
        <SearchIcon class="w-5 h-5" />
      </button>

      <!-- Theme Toggle -->
      <SelectRoot v-model="theme">
        <SelectTrigger
          class="flex items-center justify-center w-10 h-10 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors bg-transparent border-none cursor-pointer outline-none"
        >
          <SunIcon v-if="theme === 'light'" class="w-5 h-5" />
          <MoonIcon v-else-if="theme === 'dark'" class="w-5 h-5" />
          <MonitorIcon v-else class="w-5 h-5" />
        </SelectTrigger>
        <SelectPortal>
          <SelectContent
            position="popper"
            class="z-50 bg-white/95 dark:bg-[#1d1d1d]/95 backdrop-blur-md border border-gray-200 dark:border-[#2a2a2a] rounded-xl shadow-xl overflow-hidden min-w-[140px] text-gray-800 dark:text-gray-200"
            :sideOffset="8"
          >
            <SelectViewport class="p-1.5">
              <SelectItem
                value="light"
                class="flex items-center gap-2.5 px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-[#2a2a2a] cursor-pointer outline-none rounded-lg data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-[#2a2a2a] data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-white transition-colors"
              >
                <SunIcon class="w-4 h-4" />
                <SelectItemText>{{ t("theme.light") }}</SelectItemText>
              </SelectItem>
              <SelectItem
                value="dark"
                class="flex items-center gap-2.5 px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-[#2a2a2a] cursor-pointer outline-none rounded-lg data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-[#2a2a2a] data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-white transition-colors"
              >
                <MoonIcon class="w-4 h-4" />
                <SelectItemText>{{ t("theme.dark") }}</SelectItemText>
              </SelectItem>
              <SelectItem
                value="system"
                class="flex items-center gap-2.5 px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-[#2a2a2a] cursor-pointer outline-none rounded-lg data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-[#2a2a2a] data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-white transition-colors"
              >
                <MonitorIcon class="w-4 h-4" />
                <SelectItemText>{{ t("theme.system") }}</SelectItemText>
              </SelectItem>
            </SelectViewport>
          </SelectContent>
        </SelectPortal>
      </SelectRoot>

      <!-- Locale Toggle -->
      <SelectRoot :modelValue="locale" @update:modelValue="setLocale">
        <SelectTrigger
          class="flex items-center justify-center w-10 h-10 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors bg-transparent border-none cursor-pointer outline-none"
        >
          <GlobeIcon class="w-5 h-5" />
        </SelectTrigger>
        <SelectPortal>
          <SelectContent
            position="popper"
            class="z-50 bg-white/95 dark:bg-[#1d1d1d]/95 backdrop-blur-md border border-gray-200 dark:border-[#2a2a2a] rounded-xl shadow-xl overflow-hidden min-w-[140px] text-gray-800 dark:text-gray-200"
            :sideOffset="8"
          >
            <SelectViewport class="p-1.5">
              <SelectItem
                value="en"
                class="flex items-center px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-[#2a2a2a] cursor-pointer outline-none rounded-lg data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-[#2a2a2a] data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-white transition-colors"
              >
                <SelectItemText>{{ t("language.en") }}</SelectItemText>
              </SelectItem>
              <SelectItem
                value="fr"
                class="flex items-center px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-[#2a2a2a] cursor-pointer outline-none rounded-lg data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-[#2a2a2a] data-[highlighted]:text-gray-900 dark:data-[highlighted]:text-white transition-colors"
              >
                <SelectItemText>{{ t("language.fr") }}</SelectItemText>
              </SelectItem>
            </SelectViewport>
          </SelectContent>
        </SelectPortal>
      </SelectRoot>

      <div class="w-px h-5 bg-gray-200 dark:bg-gray-700/50 mx-1 md:mx-2 hidden sm:block"></div>

      <!-- User Profile -->
      <template v-if="user">
        <NuxtLink
          :to="$localePath('/profile')"
          class="relative flex items-center justify-center w-9 h-9 md:w-10 md:h-10 ml-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 ring-2 ring-transparent hover:ring-gray-200 dark:hover:ring-gray-700 transition-all overflow-hidden cursor-pointer"
          :aria-label="t('nav.profile', 'Profile')"
        >
          <img v-if="user.user_metadata?.avatar_url" :src="user.user_metadata.avatar_url" alt="Avatar" class="w-full h-full object-cover" />
          <UserIcon v-else class="w-5 h-5" />
        </NuxtLink>
      </template>
      <template v-else>
        <NuxtLink
          :to="$localePath('/login')"
          class="flex items-center justify-center h-9 px-4 ml-1 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 rounded-full transition-all shadow-sm hover:shadow-md"
          :aria-label="t('nav.login')"
        >
          {{ t("nav.login") }}
        </NuxtLink>
      </template>
    </div>

    <SearchModal v-model:open="isSearchOpen" />
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
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
const { t, locale, setLocale } = useI18n();
const localePath = useLocalePath();
const { isSearchOpen } = useSearchModal();
const user = useSupabaseUser();
const route = useRoute();

const isHomePage = computed(() => {
  const homePath = localePath('/');
  return route.path === homePath;
});

const isAdmin = computed(() => {
  return user.value?.app_metadata?.role === 'admin' || user.value?.user_metadata?.role === 'admin';
});
</script>
