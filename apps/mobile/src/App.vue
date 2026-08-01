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
import { useOneSignal } from "@/composables/useOneSignal";
import { onMounted } from "vue";
import { App, URLOpenListenerEvent } from "@capacitor/app";

const authStore = useAuthStore();
const { handleDeepLink } = useDeepLinkHandler();
const { initTheme } = useTheme();
const { initOneSignal } = useOneSignal();

// Initialize auth and handle deep links
onMounted(async () => {
  initTheme();
  initOneSignal();
  // Handle deep links when app is already open
  App.addListener("appUrlOpen", (event: URLOpenListenerEvent) => {
    // Extract the URL from the event
    const url = new URL(event.url);

    console.log("url", url.toString());

    // Convert capacitor:// URL to our custom scheme for parsing
    const deepLink = url
      .toString()
      .replace(/^capacitor:\/\//, "dubbingbase://");
    console.log("deepLink", deepLink.toString());

    // Parse the deep link
    handleDeepLink(deepLink.toString());
  });
});
</script>

<style scoped></style>
