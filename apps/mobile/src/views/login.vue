<template>
  <ion-page>
  <AppPage>
    <AppHeader>
      <AppToolbar color="primary">
        <AppTitle>{{ isRegister ? 'Créer un compte' : 'Connexion' }}</AppTitle>
        <template #start >
          <AppBackButton />
        </template>
      </AppToolbar>
    </AppHeader>
    <AppContent class="ion-padding">
      <form @submit.prevent="isRegister ? register() : login()">
        <AppList>
          <AppListItem>
            <AppText position="floating">Email</AppText>
            <AppInput v-model="email" type="email" required></AppInput>
          </AppListItem>
          <AppListItem>
            <AppText position="floating">Mot de passe</AppText>
            <AppInput v-model="password" type="password" required></AppInput>
          </AppListItem>
        </AppList>
        <AppButton expand="block" type="submit" :disabled="loading">
          {{ loading ? (isRegister ? 'Création...' : 'Connexion...') : (isRegister ? 'Créer un compte' : 'Se connecter') }}
        </AppButton>
        <AppButton expand="block" fill="clear" type="button" @click="isRegister = !isRegister">
          {{ isRegister ? 'Déjà un compte ? Se connecter' : "Pas de compte ? S'inscrire" }}
        </AppButton>
        <AppText color="danger" v-if="error" class="error-message">
  <p>{{ error }}</p>
</AppText>
      </form>
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
import { toastController } from '@/composables/useToast';
import AppList from '@/components/common/AppList.vue';
import AppListItem from '@/components/common/AppListItem.vue';
import AppButton from '@/components/common/AppButton.vue';
import AppInput from '@/components/common/AppInput.vue';
import AppText from '@/components/common/AppText.vue';
import AppSpinner from '@/components/common/AppSpinner.vue';
import AppSkeleton from '@/components/common/AppSkeleton.vue';
import { ref, onMounted } from 'vue';
import AppBackButton from "@/components/common/AppBackButton.vue";
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const isRegister = ref(false);

const authStore = useAuthStore();
const router = useRouter();
const route = useRoute();

// Handle redirect after successful login
const handleSuccessfulAuth = () => {
  const redirectPath = Array.isArray(route.query.redirect)
    ? route.query.redirect[0]
    : route.query.redirect || '/tabs/home';

  // Ensure we don't redirect back to login
  if (redirectPath === '/login') {
    router.push('/tabs/home');
  } else {
    router.push(redirectPath as string);
  }
};

const login = async () => {
  error.value = '';
  loading.value = true;

  try {
    const { error: signInError } = await authStore.signIn(email.value, password.value);

    if (signInError) {
      // Handle specific authentication errors
      if (signInError.message.includes('Invalid login credentials') ||
          signInError.message.includes('Email not confirmed')) {
        error.value = 'Email ou mot de passe incorrect';
      } else if (signInError.message.includes('Email rate limit exceeded')) {
        error.value = 'Trop de tentatives de connexion. Veuillez réessayer plus tard.';
      } else {
        error.value = 'Une erreur est survenue lors de la connexion';
      }
      // Clear password field on error for security
      password.value = '';
      return;
    }

    // If no error, proceed with successful auth
    handleSuccessfulAuth();
  } catch (err: any) {
    // Handle unexpected errors
    console.error('Unexpected login error:', err);
    error.value = 'Une erreur inattendue est survenue';
  } finally {
    loading.value = false;
  }
};

const register = async () => {
  error.value = '';
  loading.value = true;

  try {
    const { error: registerError } = await authStore.signUp(email.value, password.value);

    if (registerError) throw registerError;

    // Show success message and switch to login
    const toast = await toastController.create({
      message: 'Compte créé avec succès ! Vous pouvez maintenant vous connecter.',
      color: 'success',
      duration: 3000
    });
    await toast.present();
    error.value = '';
    isRegister.value = false;
  } catch (err: any) {
    error.value = err.message || "Échec de la création du compte";
    console.error('Registration error:', err);
  } finally {
    loading.value = false;
  }
};
</script>


<style scoped>


.app-padding {
  padding: 2rem;
}

.error-message {
  display: block;
  margin-top: 1rem;
  text-align: center;
  font-size: 0.9rem;
  line-height: 1.4;
  padding: 0.5rem;
  background-color: rgba(var(--app-color-danger-rgb), 0.1);
  border-radius: 4px;
}
</style>
