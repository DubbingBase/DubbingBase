<template>
  <ion-page>
    <ion-tabs>
      <ion-router-outlet></ion-router-outlet>
      <ion-tab-bar slot="bottom">
        <ion-tab-button
          v-for="item in items"
          :key="item.route"
          :tab="item.route"
          :href="item.href"
        >
          <component :is="item.icon"></component>
          <ion-label>{{ item.label }}</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  </ion-page>
  <!-- <k-tabbar class="left-0 bottom-0 fixed">
    <k-tabbar-link
      v-for="item in items"
      :active="active === item.route"
      @click="onTabClick(item)"
      :linkProps="{ to: item.route }"
    >
      <template #label> {{ item.label }} </template>
      <template #icon>
        <k-icon>
          <i :class="item.icon" />
        </k-icon>
      </template>
    </k-tabbar-link>
  </k-tabbar> -->
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { IonPage, IonTabs, IonTabBar, IonTabButton, IonLabel, IonRouterOutlet } from "@ionic/vue";
import SolarTvLinear from '~icons/solar/tv-linear'
import SolarMagniferLinear from '~icons/solar/magnifer-linear'
import SolarHome2Linear from '~icons/solar/home-2-linear'
import SolarSettingsLinear from '~icons/solar/settings-linear'
import SolarUserLinear from '~icons/solar/user-linear'
import { useAuthStore } from "@/stores/auth";

interface TabItem {
  label: string;
  icon: string;
  route: string;
}

const router = useRouter();

const active = ref<string>("home");
import { supabase } from '@/api/supabase';
const authStore = useAuthStore();

const items = computed(() => {
  const items = [
    {
      label: "Accueil",
      icon: SolarHome2Linear,
      route: "Home",
      href: "/tabs/home",
    },
    {
      label: "Recherche",
      icon: SolarMagniferLinear,
      route: "Search",
      href: "/tabs/search",
    },
    {
      label: "Parametres",
      icon: SolarSettingsLinear,
      route: "Settings",
      href: "/tabs/settings",
    },
  ];

  if (authStore.isAdmin) {
    items.push({
      label: "Admin",
      icon: SolarSettingsLinear,
      route: "Admin",
      href: "/tabs/admin",
    });
  }

  if (authStore.isAuthenticated && !authStore.isAnonymous) {
    items.push({
      label: "Profil",
      icon: SolarUserLinear,
      route: "Profile",
      href: "/tabs/profile",
    });
  }

  return items;
});
</script>

<style scoped>
.base {
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: rgb(42, 42, 42);
  color: white;
}

.content {
  height: 100%;
  padding: 8px;
  overflow: auto;
}

.top-bar {
  display: flex;
  justify-content: center;
  background-color: rgb(38, 38, 38);
  padding: 16px 16px;
  color: white;
}

.tab-menu {
}
</style>
