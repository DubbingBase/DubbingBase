<template>
  <header
    class="sticky top-0 z-50 flex items-center justify-between h-[68px] px-4 md:px-6 border-b theme-border-subtle theme-header backdrop-blur-xl transition-colors"
  >
    <!-- Left Section: Logo & Nav -->
    <div class="flex items-center gap-6 w-full sm:w-auto sm:flex-none">
      <NuxtLink
        :to="localePath('/')"
        class="flex items-center gap-3 group shrink-0"
      >
        <div
          class="w-9 h-9 rounded-xl overflow-hidden shadow-sm ring-1 theme-ring-subtle group-hover:shadow-md transition-all"
        >
          <img
            :src="useNewLogo ? '/logo2.png' : '/apple-touch-icon.png'"
            alt="Logo"
            class="w-full h-full object-cover"
          />
        </div>
        <span
          class="text-xl font-bold tracking-tight theme-text hidden sm:block"
        >
          {{ t("app.title") }}
        </span>
      </NuxtLink>

      <nav class="flex items-center gap-1 ml-2">
        <NuxtLink
          v-if="!isHomePage"
          :to="localePath('/')"
          class="px-3 py-1.5 text-sm font-medium theme-text-secondary theme-hover-text rounded-lg theme-hover-surface-muted transition-all"
        >
          {{ t("nav.home") }}
        </NuxtLink>
        <NuxtLink
          v-if="user && isAdmin"
          :to="localePath('/admin')"
          class="px-3 py-1.5 text-sm font-medium theme-text-secondary theme-hover-text rounded-lg theme-hover-surface-muted transition-all"
        >
          {{ t("nav.admin") }}
        </NuxtLink>
      </nav>
    </div>

    <!-- Center Section: Search -->
    <div class="flex-1 max-w-md mx-4 hidden sm:flex justify-center">
      <NuxtLink
        :to="localePath('/search')"
        data-testid="header-search-trigger"
        class="group flex items-center justify-between w-full max-w-[320px] h-10 px-4 text-sm theme-text-muted theme-surface-raised theme-hover-surface-muted border border-transparent theme-hover-border rounded-full transition-all shadow-sm hover:shadow-md"
        :aria-label="t('search.placeholder')"
      >
        <span
          class="flex items-center gap-2 theme-text-muted group-hover:text-[var(--app-color-text-secondary)] transition-colors"
        >
          <SearchIcon :size="16" />
          <span>{{ t("search.placeholder") }}</span>
        </span>
        <kbd
          class="hidden md:inline-flex items-center justify-center w-5 h-5 text-[11px] font-medium theme-text-muted theme-surface-muted border theme-border-strong rounded transition-opacity"
        >
          /
        </kbd>
      </NuxtLink>
    </div>

    <!-- Right Section: Actions & Profile -->
    <div class="flex items-center gap-1 md:gap-2 ml-auto shrink-0">
      <!-- Mobile Search Trigger -->
      <NuxtLink
        :to="localePath('/search')"
        data-testid="mobile-search-trigger"
        :aria-label="t('search.placeholder')"
        class="sm:hidden p-2 theme-text-muted theme-hover-text theme-text-muted theme-hover-text theme-hover-surface-muted rounded-full transition-colors flex items-center justify-center"
      >
        <SearchIcon :size="20" />
      </NuxtLink>

      <!-- Theme Toggle -->
      <ClientOnly>
        <SelectRoot v-model="theme">
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
        <template #fallback>
          <div
            class="w-10 h-10 rounded-full theme-surface-raised animate-pulse"
          ></div>
        </template>
      </ClientOnly>

      <!-- Locale Toggle -->
      <ClientOnly>
        <SelectRoot :modelValue="locale" @update:modelValue="setLocale">
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
                  value="en"
                  class="flex items-center px-3 py-2 text-sm font-medium theme-hover-surface-muted cursor-pointer outline-none rounded-lg data-[highlighted]:bg-[var(--app-color-surface-muted)] data-[highlighted]:text-[var(--app-color-text)] transition-colors"
                >
                  <SelectItemText>{{ t("language.en") }}</SelectItemText>
                </SelectItem>
                <SelectItem
                  value="fr"
                  class="flex items-center px-3 py-2 text-sm font-medium theme-hover-surface-muted cursor-pointer outline-none rounded-lg data-[highlighted]:bg-[var(--app-color-surface-muted)] data-[highlighted]:text-[var(--app-color-text)] transition-colors"
                >
                  <SelectItemText>{{ t("language.fr") }}</SelectItemText>
                </SelectItem>
                <SelectItem
                  value="es"
                  class="flex items-center px-3 py-2 text-sm font-medium theme-hover-surface-muted cursor-pointer outline-none rounded-lg data-[highlighted]:bg-[var(--app-color-surface-muted)] data-[highlighted]:text-[var(--app-color-text)] transition-colors"
                >
                  <SelectItemText>{{ t("language.es") }}</SelectItemText>
                </SelectItem>
                <SelectItem
                  value="ja"
                  class="flex items-center px-3 py-2 text-sm font-medium theme-hover-surface-muted cursor-pointer outline-none rounded-lg data-[highlighted]:bg-[var(--app-color-surface-muted)] data-[highlighted]:text-[var(--app-color-text)] transition-colors"
                >
                  <SelectItemText>{{ t("language.ja") }}</SelectItemText>
                </SelectItem>
              </SelectViewport>
            </SelectContent>
          </SelectPortal>
        </SelectRoot>
        <template #fallback>
          <div
            class="w-10 h-10 rounded-full theme-surface-raised animate-pulse"
          ></div>
        </template>
      </ClientOnly>

      <div
        class="w-px h-5 theme-surface-muted mx-1 md:mx-2 hidden sm:block"
      ></div>

      <!-- User Profile -->
      <ClientOnly>
        <template v-if="user">
          <NuxtLink
            :to="localePath('/profile')"
            class="relative flex items-center justify-center w-9 h-9 md:w-10 md:h-10 ml-1 rounded-full theme-surface-muted theme-text-secondary ring-2 ring-transparent hover:ring-[var(--app-color-border-strong)] transition-all overflow-hidden cursor-pointer"
            :aria-label="t('nav.profile', 'Profile')"
          >
            <img
              v-if="user.user_metadata?.avatar_url"
              :src="user.user_metadata.avatar_url"
              alt="Avatar"
              class="w-full h-full object-cover"
            />
            <UserIcon v-else :size="20" />
          </NuxtLink>
        </template>
        <template v-else>
          <NuxtLink
            :to="localePath('/login')"
            class="flex items-center justify-center h-9 px-4 ml-1 text-sm font-semibold theme-contrast theme-hover-contrast rounded-full transition-all shadow-sm hover:shadow-md"
            :aria-label="t('nav.login')"
          >
            {{ t("nav.login") }}
          </NuxtLink>
        </template>

        <template #fallback>
          <div
            class="w-9 h-9 md:w-10 md:h-10 ml-1 rounded-full theme-surface-raised theme-surface-muted animate-pulse"
          ></div>
        </template>
      </ClientOnly>
    </div>
  </header>
</template>

<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, computed } from "vue";

const useNewLogo = ref(false);
import { useRoute } from "vue-router";
import { useTheme } from "../composables/useTheme";
import {
  SunIcon,
  MoonIcon,
  UserIcon,
  GlobeIcon,
  MonitorIcon,
  SearchIcon,
} from "lucide-vue-next";
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
const switchLocalePath = useSwitchLocalePath();
const localePath = useLocalePath();
const setLocale = (val: any) => {
  navigateTo(switchLocalePath(val));
};
const user = useSupabaseUser();
const route = useRoute();

const isHomePage = computed(() => {
  const homePath = localePath("/");
  return route.path === homePath;
});

const isAdmin = computed(() => {
  return (
    user.value?.app_metadata?.role === "admin" ||
    user.value?.user_metadata?.role === "admin"
  );
});

const focusSearchInput = (): void => {
  document
    .querySelector<HTMLInputElement>("[data-testid='search-input']")
    ?.focus();
};

const goToSearch = async (): Promise<void> => {
  if (route.path !== localePath("/search")) {
    await navigateTo(localePath("/search"));
  }
  await nextTick();
  focusSearchInput();
};

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
  );
};

const handleGlobalKeydown = (event: KeyboardEvent): void => {
  if (
    (event.metaKey || event.ctrlKey) &&
    (event.key.toLowerCase() === "k" || event.code === "KeyK")
  ) {
    event.preventDefault();
    void goToSearch();
    return;
  }

  if (
    (event.key === "/" || event.code === "Slash") &&
    !isEditableTarget(event.target)
  ) {
    event.preventDefault();
    void goToSearch();
  }
};

onMounted(() => {
  document.addEventListener("keydown", handleGlobalKeydown, true);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleGlobalKeydown, true);
});
</script>
