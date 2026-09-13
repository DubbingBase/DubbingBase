<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="mb-8">
      <h1 class="text-3xl font-extrabold theme-text">
        {{ $t("profile.account") }}
      </h1>
      <p class="mt-2 text-sm theme-text-muted">{{ $t("profile.subtitle") }}</p>
    </div>

    <div class="flex flex-col md:flex-row gap-8">
      <!-- Sidebar Navigation -->
      <aside class="w-full md:w-64 shrink-0">
        <nav class="flex flex-col space-y-1">
          <NuxtLink
            :to="localePath('/profile')"
            class="flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            active-class="theme-selected"
            exact-active-class="theme-selected"
            :class="[
              route.path === localePath('/profile') ||
              route.path === localePath('/profile/')
                ? 'theme-selected'
                : 'theme-text-secondary theme-hover-surface-muted',
            ]"
            >{{ $t("profile.title") }}</NuxtLink
          >
          <NuxtLink
            :to="localePath('/profile/api-key')"
            class="flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            active-class="theme-selected"
            :class="[
              route.path === localePath('/profile/api-key') ||
              route.path === localePath('/profile/api-key/')
                ? 'theme-selected'
                : 'theme-text-secondary theme-hover-surface-muted',
            ]"
            >{{ $t("profile.apiKey") }}</NuxtLink
          >
          <NuxtLink
            :to="localePath('/profile/settings')"
            class="flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            active-class="theme-selected"
            :class="[
              route.path === localePath('/profile/settings') ||
              route.path === localePath('/profile/settings/')
                ? 'theme-selected'
                : 'theme-text-secondary theme-hover-surface-muted',
            ]"
            >{{ $t("profile.settings") }}</NuxtLink
          >
        </nav>

        <div class="mt-8">
          <button
            @click="handleLogout"
            class="w-full flex justify-center items-center px-4 py-2 border rounded-lg text-sm font-medium theme-status-danger transition-colors"
          >
            {{ $t("profile.logout") }}
          </button>
        </div>
      </aside>

      <!-- Main Content Area -->
      <main class="flex-1">
        <div
          class="theme-surface shadow-xl rounded-2xl border theme-border-subtle p-6 md:p-8"
        >
          <NuxtPage />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from "vue-router";

definePageMeta({
  middleware: "auth",
});

useSeoMeta({
  title: "Profile - DubbingBase",
  description: "Manage your DubbingBase account and preferences.",
  robots: "noindex, nofollow",
});

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();

const localePath = useLocalePath();
const handleLogout = async () => {
  await supabase.auth.signOut();
  router.push(localePath("/login"));
};
</script>
