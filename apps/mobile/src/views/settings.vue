<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ t('settings.title') }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-list v-if="user?.is_anonymous === false">
        <ion-item lines="full">
          <AppText>{{ t('settings.email') }}</AppText>
          <AppText>{{ user?.email }}</AppText>
        </ion-item>
        <ion-item button @click="navigateToAbout">
          <AppText>{{ t('settings.about') }}</AppText>
        </ion-item>
        <ion-item button @click="logout">
          <AppText color="danger">{{ t('settings.logout') }}</AppText>
        </ion-item>
      </ion-list>
      <AppText color="medium" v-else>
        <ion-button @click="login">{{ t('settings.login') }}</ion-button>
      </AppText>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import AppText from '@/components/common/AppText.vue';
import AppSpinner from '@/components/common/AppSpinner.vue';
import AppSkeleton from '@/components/common/AppSkeleton.vue';
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonButton } from '@ionic/vue';
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
  router.push('/login');
};

const login = () => {
  router.push('/login');
};

const navigateToAbout = () => {
  router.push('/tabs/about');
};
</script>

<style scoped>
.ion-padding {
  padding: 2rem;
}
</style>
