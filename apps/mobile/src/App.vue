<template>
  <ion-app id="app-root" class="app-root">
    <ion-router-outlet />
    <Toaster position="bottom-center" />
    <AppAlertContainer />
  </ion-app>
</template>

<script setup lang="ts">

import { IonApp, IonRouterOutlet } from '@ionic/vue';
import { Toaster } from 'vue-sonner';
import AppAlertContainer from "@/components/common/AppAlertContainer.vue";
import { useAuthStore } from "@/stores/auth";
import { useDeepLinkHandler } from "@/utils/deepLinks";
import { useTheme } from "@/composables/useTheme";

import { onMounted } from "vue";
import { App, URLOpenListenerEvent } from "@capacitor/app";

const authStore = useAuthStore();
const { handleDeepLink } = useDeepLinkHandler();
const { initTheme } = useTheme();
// Initialize auth and handle deep links
onMounted(async () => {
  initTheme();
  // Handle deep links when app is already open
  App.addListener("appUrlOpen", (event: URLOpenListenerEvent) => {
    console.log("[DeepLink] App opened with URL:", event.url);
    handleDeepLink(event.url);
  });
});
</script>

<style scoped></style>
