<template>
  <div class="base-layout">
    <div class="content">
      <router-view v-slot="{ Component }">
        <keep-alive include="Home,Search">
          <component :is="Component" />
        </keep-alive>
      </router-view>
    </div>
    <div class="bottom-tab-bar">
      <router-link
        v-for="item in items"
        :key="item.route"
        :to="item.href"
        class="tab-button"
        active-class="active-tab"
      >
        <component :is="item.icon" class="tab-icon"></component>
        <span class="tab-label">{{ item.label }}</span>
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import Tv from '~icons/lucide/tv';
import Search from '~icons/lucide/search';
import Home from '~icons/lucide/home';
import Settings from '~icons/lucide/settings';
import User from '~icons/lucide/user';
import { useAuthStore } from "@/stores/auth";

interface TabItem {
  label: string;
  icon: string;
  route: string;
}

const router = useRouter();

const active = ref<string>("home");
import { supabase } from "@/api/supabase";
const authStore = useAuthStore();

const items = computed(() => {
  const items = [
    {
      label: "Accueil",
      icon: Home,
      route: "Home",
      href: "/tabs/home",
    },
    {
      label: "Recherche",
      icon: Search,
      route: "Search",
      href: "/tabs/search",
    },
    {
      label: "Parametres",
      icon: Settings,
      route: "Settings",
      href: "/tabs/settings",
    },
  ];

  if (authStore.isAuthenticated && !authStore.isAnonymous) {
    items.push({
      label: "Profil",
      icon: User,
      route: "Profile",
      href: "/tabs/profile",
    });
  }

  return items;
});
</script>

<style scoped>
.base-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--ion-background-color, rgb(28, 28, 29));
}

.content {
  flex: 1;
  overflow: auto;
  position: relative;
}

.bottom-tab-bar {
  display: flex;
  justify-content: space-around;
  align-items: center;
  background-color: var(--ion-tab-bar-background, rgb(28, 28, 29));
  padding: 8px 0;
  padding-bottom: env(safe-area-inset-bottom, 8px);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.tab-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: var(--ion-tab-bar-color, #999);
  flex: 1;
  transition: color 0.2s;
}

.active-tab {
  color: var(--ion-tab-bar-color-selected, #428cff);
}

.tab-icon {
  font-size: 12px;
  margin-bottom: 2px;
}

.tab-label {
  font-size: 10px;
}
</style>
