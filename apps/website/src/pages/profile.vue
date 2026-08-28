<template>
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
    <div class="mb-8">
      <h1 class="text-3xl font-extrabold text-gray-900 dark:text-white">Account</h1>
      <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Manage your profile, API keys, and settings.</p>
    </div>

    <div class="flex flex-col md:flex-row gap-8">
      <!-- Sidebar Navigation -->
      <aside class="w-full md:w-64 shrink-0">
        <nav class="flex flex-col space-y-1">
          <NuxtLink
            :to="localePath('/profile')"
            class="flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            active-class="bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300"
            exact-active-class="bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300"
            :class="[route.path === localePath('/profile') || route.path === localePath('/profile/') ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' : 'text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5']"
          >
            Profile
          </NuxtLink>
          <NuxtLink
            :to="localePath('/profile/api-key')"
            class="flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            active-class="bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300"
            :class="[route.path === localePath('/profile/api-key') || route.path === localePath('/profile/api-key/') ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' : 'text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5']"
          >
            API Key
          </NuxtLink>
          <NuxtLink
            :to="localePath('/profile/settings')"
            class="flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors"
            active-class="bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300"
            :class="[route.path === localePath('/profile/settings') || route.path === localePath('/profile/settings/') ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300' : 'text-gray-900 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5']"
          >
            Settings
          </NuxtLink>
        </nav>
        
        <div class="mt-8">
          <button @click="handleLogout" class="w-full flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-red-700 bg-red-100 hover:bg-red-200 dark:text-red-400 dark:bg-red-900/30 dark:hover:bg-red-900/50 transition-colors">
            Log out
          </button>
        </div>
      </aside>

      <!-- Main Content Area -->
      <main class="flex-1">
        <div class="bg-white dark:bg-[#18181b] shadow-xl rounded-2xl border border-gray-200 dark:border-white/5 p-6 md:p-8">
          <NuxtPage />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';

definePageMeta({
  middleware: 'auth'
});

useSeoMeta({
  title: 'Profile - DubbingBase',
  description: 'Manage your DubbingBase account and preferences.',
  robots: 'noindex, nofollow'
});

const route = useRoute();
const router = useRouter();
const supabase = useSupabaseClient();

const localePath = useLocalePath();
const handleLogout = async () => {
  await supabase.auth.signOut();
  router.push(localePath('/login'));
};
</script>
