<template>
  <div class="h-screen w-full flex bg-slate-950 text-slate-100 overflow-hidden">
    <!-- Mobile Navigation Bar -->
    <header class="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 z-40">
      <h1 class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
        DubbingBase Admin
      </h1>
      <button @click="isSidebarOpen = !isSidebarOpen" class="text-slate-400 hover:text-white p-2">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path v-if="!isSidebarOpen" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </header>

    <!-- Sidebar Backdrop for Mobile -->
    <div
      v-if="isSidebarOpen"
      @click="isSidebarOpen = false"
      class="lg:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40"
    ></div>

    <!-- Sidebar (Drawer on mobile, fixed on desktop) -->
    <aside
      :class="[
        'fixed inset-y-0 left-0 w-72 bg-slate-900 border-r border-slate-800 z-50 transform lg:translate-x-0 transition-transform duration-300 ease-in-out flex flex-col',
        isSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:static lg:h-screen lg:shrink-0'
      ]"
    >
      <!-- Sidebar Header -->
      <div class="h-16 flex items-center justify-between px-6 border-b border-slate-800 shrink-0">
        <h1 class="text-2xl font-black tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
          DubbingBase
        </h1>
        <span class="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full font-mono font-semibold border border-slate-700/50">
          v{{ version }}
        </span>
      </div>

      <!-- Navigation Links -->
      <nav class="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-150 group font-medium text-sm text-slate-400 hover:text-white hover:bg-slate-800/50"
          exact-active-class="bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600/15 hover:text-blue-300"
          @click="isSidebarOpen = false"
        >
          <span class="shrink-0 text-current" v-html="item.icon"></span>
          <span>{{ item.name }}</span>
        </router-link>
      </nav>

      <!-- Sidebar Footer (Auth Session) -->
      <div class="p-4 border-t border-slate-800 shrink-0 bg-slate-900/50 space-y-3">
        <div class="flex items-center space-x-3 px-2">
          <div class="h-9 w-9 rounded-full bg-slate-800 flex items-center justify-center text-blue-400 font-bold border border-slate-700">
            {{ user?.email ? user.email.charAt(0).toUpperCase() : 'A' }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Connected as</p>
            <p class="text-xs text-slate-300 truncate font-medium">{{ user?.email }}</p>
          </div>
        </div>
        <button
          @click="handleSignOut"
          class="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-semibold border border-slate-700 transition-all duration-150"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Sign Out</span>
        </button>
      </div>
    </aside>

    <!-- Main Content Wrapper -->
    <div class="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden pt-16 lg:pt-0">
      <!-- Top header on desktop -->
      <header class="hidden lg:flex h-16 border-b border-slate-800 items-center justify-between px-8 bg-slate-900/40 backdrop-blur-md sticky top-0 z-35">
        <h2 class="text-lg font-bold text-white">{{ currentSectionName }}</h2>
        <div class="flex items-center space-x-4">
          <span class="text-xs px-2.5 py-1 bg-green-500/10 text-green-400 rounded-full font-semibold border border-green-500/20">
            Admin Session
          </span>
        </div>
      </header>

      <!-- Main viewport -->
      <main class="flex-1 p-6 lg:p-8 bg-slate-950">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import pkg from "../../../../package.json";

const supabase = useSupabaseClient();
const user = useSupabaseUser();

const version = pkg.version;
const route = useRoute();
const router = useRouter();
const isSidebarOpen = ref(false);

// Navigation items config with SVG strings
const navItems = [
  {
    name: "Dashboard",
    path: "/",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`
  },
  {
    name: "Spreadsheet",
    path: "/voice-actor-spreadsheet",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>`
  },
  {
    name: "Import Queue",
    path: "/queue",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 7.89H18"/></svg>`
  },
  {
    name: "Duplicate Voice Actors",
    path: "/duplicates-va",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>`
  },
  {
    name: "Manual VA Merge",
    path: "/manual-merge-va",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>`
  },
  {
    name: "Career Grid Image",
    path: "/career-grid",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>`
  },
  {
    name: "Duplicate Work",
    path: "/duplicates-work",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>`
  },
  {
    name: "User Roles",
    path: "/users",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`
  },
  {
    name: "Link Profiles",
    path: "/user-va-profiles",
    icon: `<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>`
  }
];

const currentSectionName = computed(() => {
  const matched = navItems.find(item => item.path === route.path);
  if (matched) return matched.name;
  if (route.path === "/voice-actors/new") return "New Voice Actor";
  if (route.path.startsWith("/voice-actors/edit/")) return "Edit Voice Actor";
  if (route.path.startsWith("/add-voice-cast/")) return "Add Voice Cast";
  return "Administration";
});

const handleSignOut = async () => {
  await supabase.auth.signOut();
  router.push("/login");
};
</script>
