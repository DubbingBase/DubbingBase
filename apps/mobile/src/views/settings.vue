<template>
  <ion-page>
  
  <AppPage>
    <AppHeader>
      <AppToolbar>
        <AppTitle>{{ t('settings.title') }}</AppTitle>
      </AppToolbar>
    </AppHeader>
    <AppContent class="ion-padding">
      <div class="settings-container">
        <template v-if="user && user.is_anonymous === false">
          <div class="settings-section">
            <h3>Account</h3>
            <div class="settings-card">
              <div class="settings-row">
                <span class="settings-label">{{ t('settings.email') }}</span>
                <span class="settings-value">{{ user?.email }}</span>
              </div>
            </div>
          </div>

          <div class="settings-section">
            <h3>Support</h3>
            <div class="settings-card clickable" @click="navigateToAbout">
              <div class="settings-row">
                <span class="settings-label">{{ t('settings.about') }}</span>
                <ChevronRight class="app-icon arrow" />
              </div>
            </div>
          </div>

          <div class="settings-section ion-margin-top">
            <div class="settings-card clickable danger" @click="logout">
              <div class="settings-row center">
                <span class="settings-label danger-text">{{ t('settings.logout') }}</span>
              </div>
            </div>
          </div>
        </template>
        
        <template v-else>
          <div class="settings-section empty-state">
            <p class="login-prompt">You are currently not logged in.</p>
            <div class="settings-card clickable primary" @click="login">
              <div class="settings-row center">
                <span class="settings-label primary-text">{{ t('settings.login') }}</span>
              </div>
            </div>
          </div>
        </template>
      </div>
    </AppContent>
  </AppPage>
  
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage } from "@ionic/vue";
import AppPage from '@/components/common/layout/AppPage.vue';
import AppHeader from '@/components/common/layout/AppHeader.vue';
import AppToolbar from '@/components/common/layout/AppToolbar.vue';
import AppTitle from '@/components/common/layout/AppTitle.vue';
import AppContent from '@/components/common/layout/AppContent.vue';
import ChevronRight from '~icons/lucide/chevron-right';
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';

import { supabase } from '@/api/supabase';

const user = ref<any>(null);
const router = useRouter();
const { t } = useI18n();

const fetchUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  user.value = session?.user || null;
};

onMounted(fetchUser);

const logout = async () => {
  await supabase.auth.signOut();
  router.push({ name: 'Login' });
};

const login = () => {
  router.push({ name: 'Login' });
};

const navigateToAbout = () => {
  router.push({ name: 'About' });
};
</script>

<style scoped>
.settings-container {
  max-width: 100%;
  margin: 0 auto;
}

.settings-section {
  margin-bottom: 2rem;
}

.settings-section h3 {
  color: #888888;
  margin-bottom: 0.75rem;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding-left: 0.5rem;
}

.settings-card {
  background: #1d1d1d;
  border-radius: 12px;
  border: 1px solid #2a2a2a;
  overflow: hidden;
}

.settings-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
}

.settings-row.center {
  justify-content: center;
}

.settings-label {
  font-weight: 500;
  color: #e0e0e0;
}

.settings-value {
  color: #a0a0a0;
  font-size: 0.95rem;
}

.settings-card.clickable {
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.settings-card.clickable:active {
  background: #2a2a2a;
}

.arrow {
  color: #888888;
  font-size: 1.25rem;
}

.danger-text {
  color: #ff4d4f;
  font-weight: 600;
}

.primary-text {
  color: #4da8ff;
  font-weight: 600;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: 3rem;
  text-align: center;
}

.login-prompt {
  color: #a0a0a0;
  margin-bottom: 1.5rem;
}

.app-padding {
  padding: 1rem;
}

/* Mobile-first responsive design */
@media (min-width: 768px) {
  .settings-container {
    max-width: 600px;
  }

  .app-padding {
    padding: 2rem;
  }
}
</style>
