<template>
  <ion-app>
    <ion-router-outlet />
  </ion-app>
</template>

<script setup lang="ts">
import { 
  IonApp, 
  IonRouterOutlet, 
  IonLoading,
  loadingController
} from '@ionic/vue';
import { useAuthStore } from '@/stores/auth';
import { useDeepLinkHandler } from '@/utils/deepLinks';
import { onMounted, ref } from 'vue';
import { App, URLOpenListenerEvent } from '@capacitor/app';

const authStore = useAuthStore();
const { handleDeepLink } = useDeepLinkHandler();

// Initialize auth and handle deep links
onMounted(async () => {

  // Handle deep links when app is already open
  App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
    // Extract the URL from the event
    const url = new URL(event.url);

    console.log('url', url.toString());
    
    // Convert capacitor:// URL to our custom scheme for parsing
    const deepLink = url.toString().replace(/^capacitor:\/\//, 'dubbingbase://');
    console.log('deepLink', deepLink.toString());
    
    // Parse the deep link
    handleDeepLink(deepLink.toString());
  });
});
</script>

<style scoped></style>
