import { createApp } from "vue";

import i18n from "./i18n";

import "./style.css";

import App from "./App.vue";

import { router } from "./router/router";
import { createPinia } from "pinia";

/* Theme variables */
import "./theme/variables.css";

import { supabase } from "@/api/supabase";
import { useAuthStore } from "@/stores/auth";
import { useOneSignal } from "@/composables/useOneSignal";

import { SplashScreen } from "@capacitor/splash-screen";

import { IonicVue } from "@ionic/vue";
import "@ionic/vue/css/core.css";
// Basic Ionic styles for components
import "@ionic/vue/css/normalize.css";
import "@ionic/vue/css/structure.css";
import "@ionic/vue/css/typography.css";

const app = createApp(App)
  .use(createPinia())
  .use(IonicVue)
  .use(router)
  .use(i18n);

router.isReady().then(async () => {
  const authStore = useAuthStore();
  const { initOneSignal } = useOneSignal();
  
  try {
    // Initialize OneSignal before auth so OneSignal.login doesn't crash on startup
    await initOneSignal();

    // Initialize auth first
    await authStore.initialize();

    // Check if we have a valid session
    const { isAuthenticated } = authStore;
    console.log("Initial auth state:", { isAuthenticated });
  } catch (error) {
    console.error("Error during app initialization:", error);
  }

  app.mount("#app");

  // Hide splash screen after app is mounted
  await SplashScreen.hide();
});
