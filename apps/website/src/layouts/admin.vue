<template>
  <div class="flex flex-col lg:flex-row w-full min-h-screen bg-white dark:bg-[#121212] text-gray-900 dark:text-white">
    
    <!-- Mobile Admin Nav Bar -->
    <div class="lg:hidden sticky top-[72px] md:top-[80px] z-40 bg-gray-50 dark:bg-[#18181b] border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center justify-between shadow-sm">
      <h2 class="text-sm font-semibold text-gray-800 dark:text-gray-200">{{ currentSectionName }}</h2>
      <button @click="isSidebarOpen = !isSidebarOpen" class="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path v-if="!isSidebarOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Sidebar Backdrop for Mobile -->
    <div
      v-if="isSidebarOpen"
      @click="isSidebarOpen = false"
      class="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-[45]"
    ></div>

    <!-- Sidebar (Drawer on mobile, sticky on desktop) -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 w-72 bg-white dark:bg-[#121212] lg:bg-transparent lg:dark:bg-transparent border-r lg:border-r-0 border-gray-200 dark:border-[#2a2a2a] z-50 transform transition-transform duration-300 ease-in-out flex flex-col',
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:sticky lg:top-[80px] lg:h-[calc(100vh-80px)] lg:shrink-0 lg:translate-x-0 lg:z-30'
      ]"
    >
      <div class="h-4 hidden lg:block shrink-0"></div> <!-- Small top padding for desktop -->

      <!-- Navigation Links -->
      <nav class="flex-1 px-4 py-4 space-y-1.5 overflow-y-auto">
        <NuxtLink
          v-for="item in navItems"
          :key="item.path"
          :to="localePath(item.path)"
          class="flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-150 group font-medium text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-800/50"
          active-class="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-500/20"
          @click="isSidebarOpen = false"
        >
          <span class="shrink-0 text-current" v-html="item.icon"></span>
          <span>{{ item.name }}</span>
        </NuxtLink>
      </nav>

    </aside>

    <!-- Main Content Wrapper -->
    <div class="flex-1 flex flex-col min-w-0">
      <main class="flex-1 p-4 lg:p-8">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
const route = useRoute();
const router = useRouter();
const localePath = useLocalePath();
const isSidebarOpen = ref(false);
const supabase = useSupabaseClient();
const user = useSupabaseUser();

// Navigation items config with SVG strings
const navItems = [
  {
    name: "Dashboard",
    path: "/admin",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`
  },
  {
    name: "Spreadsheet",
    path: "/admin/voice-actor-spreadsheet",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`
  },
  {
    name: "Import Queue",
    path: "/admin/queue",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18"/></svg>`
  },
  {
    name: "Reports",
    path: "/admin/reports",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"/></svg>`
  },
  {
    name: "Duplicate Voice Actors",
    path: "/admin/duplicates-va",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`
  },
  {
    name: "Manual VA Merge",
    path: "/admin/manual-merge-va",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>`
  },
  {
    name: "Career Grid Image",
    path: "/admin/career-grid",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`
  },
  {
    name: "Duplicate Work",
    path: "/admin/duplicates-work",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>`
  },
  {
    name: "User Roles",
    path: "/admin/users",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`
  },
  {
    name: "Link Profiles",
    path: "/admin/user-va-profiles",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>`
  }
];

const currentSectionName = computed(() => {
  const matched = navItems.find(item => item.path === route.path);
  if (matched) return matched.name;
  if (route.path === "/admin/voice-actors/new") return "New Voice Actor";
  if (route.path.startsWith("/admin/voice-actors/edit/")) return "Edit Voice Actor";
  if (route.path.startsWith("/admin/add-voice-cast/")) return "Add Voice Cast";
  return "Administration";
});
</script>
