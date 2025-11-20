<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>{{ t('settings.title') }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-list v-if="user?.is_anonymous === false">
        <ion-item lines="full">
          <ion-label>{{ t('settings.email') }}</ion-label>
          <ion-text>{{ user?.email }}</ion-text>
        </ion-item>
        <ion-item button @click="navigateToAbout">
          <ion-label>{{ t('settings.about') }}</ion-label>
        </ion-item>
        <ion-item button @click="logout">
          <ion-label color="danger">{{ t('settings.logout') }}</ion-label>
        </ion-item>
      </ion-list>
      <ion-text color="medium" v-else>
        <ion-button @click="login">{{ t('settings.login') }}</ion-button>
      </ion-text>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useIonRouter } from '@ionic/vue';
import { useI18n } from 'vue-i18n';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonText, IonButton } from '@ionic/vue';
import { supabase } from '@/api/supabase';

const user = ref<any>(null);
const ionRouter = useIonRouter();
const { t } = useI18n();

const fetchUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  user.value = session?.user || null;
};

onMounted(fetchUser);

const logout = async () => {
  await supabase.auth.signOut();
  ionRouter.push('/login');
};

const login = () => {
  ionRouter.push('/login');
};

const navigateToAbout = () => {
  ionRouter.push('/tabs/about');
};
</script>

<style scoped>
.ion-padding {
  padding: 2rem;
}
</style>
