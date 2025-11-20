import { createApp } from 'vue'

import { IonicVue } from '@ionic/vue';
import i18n from './i18n';

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css';
import '@ionic/vue/css/structure.css';
import '@ionic/vue/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css';
import '@ionic/vue/css/float-elements.css';
import '@ionic/vue/css/text-alignment.css';
import '@ionic/vue/css/text-transformation.css';
import '@ionic/vue/css/flex-utils.css';
import '@ionic/vue/css/display.css';

import './style.css';

import App from './App.vue'

import { router } from './router/router'
import { createPinia } from 'pinia';


/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* @import '@ionic/vue/css/palettes/dark.always.css'; */
/* @import '@ionic/vue/css/palettes/dark.class.css'; */
import '@ionic/vue/css/palettes/dark.system.css';

/* Theme variables */
import './theme/variables.css';

import { supabase } from '@/api/supabase';
import { useAuthStore } from '@/stores/auth';




const app = createApp(App)
.use(IonicVue)
.use(router)
.use(createPinia())
.use(i18n);



router.isReady().then(async () => {
  const authStore = useAuthStore();
  try {
    // Initialize auth first
    await authStore.initialize();

    // Check if we have a valid session
    const { isAuthenticated } = authStore;
    console.log('Initial auth state:', { isAuthenticated });

  } catch (error) {
    console.error('Error during app initialization:', error);
  }

  app.mount('#app');
});
