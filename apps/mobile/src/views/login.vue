<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>{{ isRegister ? 'Créer un compte' : 'Connexion' }}</ion-title>
        <ion-buttons slot="start">
          <ion-back-button :default-href="{ name: 'Home' }" />
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <form @submit.prevent="isRegister ? register() : login()">
        <ion-list>
          <ion-item>
            <ion-label position="floating">Email</ion-label>
            <ion-input v-model="email" type="email" required></ion-input>
          </ion-item>
          <ion-item>
            <ion-label position="floating">Mot de passe</ion-label>
            <ion-input v-model="password" type="password" required></ion-input>
          </ion-item>
        </ion-list>
        <ion-button expand="block" type="submit" :disabled="loading">
          {{ loading ? (isRegister ? 'Création...' : 'Connexion...') : (isRegister ? 'Créer un compte' : 'Se connecter') }}
        </ion-button>
        <ion-button expand="block" fill="clear" type="button" @click="isRegister = !isRegister">
          {{ isRegister ? 'Déjà un compte ? Se connecter' : "Pas de compte ? S'inscrire" }}
        </ion-button>
        <ion-text color="danger" v-if="error" class="error-message">
  <p>{{ error }}</p>
</ion-text>
      </form>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useIonRouter } from '@ionic/vue';
import { useRoute } from 'vue-router';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonInput, IonButton, IonText, IonButtons, IonBackButton, toastController } from '@ionic/vue';
import { useAuthStore } from '@/stores/auth';

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const isRegister = ref(false);

const authStore = useAuthStore();
const ionRouter = useIonRouter();
const route = useRoute();

// Handle redirect after successful login
const handleSuccessfulAuth = () => {
  const redirectPath = Array.isArray(route.query.redirect)
    ? route.query.redirect[0]
    : route.query.redirect || '/tabs/home';

  // Ensure we don't redirect back to login
  if (redirectPath === '/login') {
    ionRouter.push('/tabs/home');
  } else {
    ionRouter.push(redirectPath);
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
.ion-padding {
  padding: 2rem;
}

.error-message {
  display: block;
  margin-top: 1rem;
  text-align: center;
  font-size: 0.9rem;
  line-height: 1.4;
  padding: 0.5rem;
  background-color: rgba(var(--ion-color-danger-rgb), 0.1);
  border-radius: 4px;
}
</style>
