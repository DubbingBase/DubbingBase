<template>
  <div id="app-root" class="app-root">
    <cap-router-outlet platform="auto" ref="outletRef">
      <router-view v-slot="{ Component, route }">
        <keep-alive :max="10">
          <component :is="Component" :key="route.path.startsWith('/tabs') ? '/tabs' : route.fullPath" />
        </keep-alive>
      </router-view>
    </cap-router-outlet>
    <AppToastContainer />
    <AppAlertContainer />
  </div>
</template>

<script setup lang="ts">

import AppToastContainer from "@/components/common/AppToastContainer.vue";
import AppAlertContainer from "@/components/common/AppAlertContainer.vue";
import { useAuthStore } from "@/stores/auth";
import { useDeepLinkHandler } from "@/utils/deepLinks";
import { onMounted, ref } from "vue";
import { App, URLOpenListenerEvent } from "@capacitor/app";
import { useRouter } from "vue-router";
import '@capgo/capacitor-transitions';
import { initTransitions, setupRouterOutlet, setDirection } from '@capgo/capacitor-transitions/vue';

const router = useRouter();

const authStore = useAuthStore();
const { handleDeepLink } = useDeepLinkHandler();
const outletRef = ref<HTMLElement | null>(null);

initTransitions({ platform: 'auto' });

// Initialize auth and handle deep links
onMounted(async () => {
  if (outletRef.value) {
    setupRouterOutlet(outletRef.value);
  }
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

  // Handle Android hardware back button / edge swipe
  App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) {
      setDirection('back');
      router.back();
    } else {
      App.exitApp();
    }
  });
});
</script>

<style scoped></style>
