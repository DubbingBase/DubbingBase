<template>
  <ion-page>
    <AppPage>
      <AppHeader>
        <AppToolbar>
          <template #start>
            <AppBackButton />
          </template>
          <AppTitle>{{ t("settings.title") }}</AppTitle>
        </AppToolbar>
      </AppHeader>
      <AppContent>
        <div class="settings-container app-padding">
          <template v-if="user && user.is_anonymous === false">
            <div class="settings-section">
              <h3>Appearance</h3>
              <div class="settings-card clickable" @click="toggleTheme">
                <div class="settings-row">
                  <div class="settings-label-group">
                    <Palette class="settings-icon text-primary" />
                    <span class="settings-label">{{
                      t("settings.theme") || "Theme"
                    }}</span>
                  </div>
                  <div class="theme-toggle">
                    <SunIcon
                      v-if="currentTheme === 'theme-light'"
                      class="app-icon text-warning"
                    />
                    <MoonIcon v-else class="app-icon text-primary" />
                  </div>
                </div>
              </div>
            </div>

            <div class="settings-section">
              <h3>Account</h3>
              <div class="settings-card">
                <div class="settings-row">
                  <div class="settings-label-group">
                    <Mail class="settings-icon text-muted" />
                    <span class="settings-label">{{
                      t("settings.email")
                    }}</span>
                  </div>
                  <span class="settings-value">{{ user?.email }}</span>
                </div>
              </div>
            </div>

            <div class="settings-section">
              <h3>Support</h3>
              <div class="settings-card clickable" @click="navigateToAbout">
                <div class="settings-row">
                  <div class="settings-label-group">
                    <Info class="settings-icon text-info" />
                    <span class="settings-label">{{
                      t("settings.about")
                    }}</span>
                  </div>
                  <ChevronRight class="app-icon arrow" />
                </div>
              </div>
            </div>

            <div class="settings-section ion-margin-top">
              <div class="settings-card clickable danger" @click="logout">
                <div class="settings-row center">
                  <div class="settings-label-group center">
                    <LogOut class="settings-icon danger-text" />
                    <span class="settings-label danger-text">{{
                      t("settings.logout")
                    }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="settings-section empty-state">
              <p class="login-prompt">You are currently not logged in.</p>
              <div class="settings-card clickable primary" @click="login">
                <div class="settings-row center">
                  <div class="settings-label-group center">
                    <span class="settings-label primary-text">{{
                      t("settings.login")
                    }}</span>
                  </div>
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
import AppPage from "@/components/common/layout/AppPage.vue";
import AppHeader from "@/components/common/layout/AppHeader.vue";
import AppToolbar from "@/components/common/layout/AppToolbar.vue";
import AppTitle from "@/components/common/layout/AppTitle.vue";
import AppContent from "@/components/common/layout/AppContent.vue";
import AppBackButton from "@/components/common/AppBackButton.vue";
import ChevronRight from "~icons/lucide/chevron-right";
import SunIcon from "~icons/lucide/sun";
import MoonIcon from "~icons/lucide/moon";
import Palette from "~icons/lucide/palette";
import Mail from "~icons/lucide/mail";
import Info from "~icons/lucide/info";
import LogOut from "~icons/lucide/log-out";
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { useTheme } from "@/composables/useTheme";

import { supabase } from "@/api/supabase";

const user = ref<{ is_anonymous?: boolean; email?: string } | null>(null);
const router = useRouter();
const { t } = useI18n();
const { currentTheme, toggleTheme } = useTheme();

const fetchUser = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  user.value = session?.user || null;
};

onMounted(fetchUser);

const logout = async () => {
  await supabase.auth.signOut();
  router.push({ name: "Login" });
};

const login = () => {
  router.push({ name: "Login" });
};

const navigateToAbout = () => {
  router.push({ name: "About" });
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
  color: var(--app-color-text-muted, #888888);
  margin-bottom: 0.75rem;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding-left: 0.5rem;
}

.settings-card {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 16px;
  border: 1px solid var(--app-color-border, #2a2a2a);
  overflow: hidden;
  transition: all 0.2s ease;
}

.settings-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.25rem 1.25rem;
}

.settings-row.center {
  justify-content: center;
}

.settings-label-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.settings-label-group.center {
  justify-content: center;
}

.settings-icon {
  font-size: 1.25rem;
  opacity: 0.8;
}

.text-primary {
  color: var(--app-color-primary, #3b82f6);
}

.text-warning {
  color: var(--app-color-warning, #f59e0b);
}

.text-info {
  color: var(--app-color-tertiary, #0ea5e9);
}

.text-muted {
  color: var(--app-color-text-muted, #888888);
}

.settings-label {
  font-weight: 500;
  color: var(--app-color-text-primary, #e0e0e0);
  font-size: 1.05rem;
}

.settings-value {
  color: var(--app-color-text-secondary, #a0a0a0);
  font-size: 0.95rem;
}

.settings-card.clickable {
  cursor: pointer;
}

.settings-card.clickable:hover {
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-1px);
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.settings-card.clickable:active {
  background: rgba(255, 255, 255, 0.02);
  transform: translateY(0);
}

.settings-card.danger {
  border-color: rgba(239, 68, 68, 0.2);
  background: rgba(239, 68, 68, 0.05);
}

.settings-card.danger:hover {
  background: rgba(239, 68, 68, 0.1);
}

.arrow {
  color: var(--app-color-text-muted, #888888);
  font-size: 1.25rem;
}

.danger-text {
  color: #ef4444;
  font-weight: 600;
}

.primary-text {
  color: var(--app-color-primary, #3b82f6);
  font-weight: 600;
}

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
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
