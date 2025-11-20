<template>
  <ion-page>
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>{{ $t('about.title') }}</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="about-container">
        <h2>{{ $t('about.attributions') }}</h2>

        <div class="attribution-section">
          <h3>{{ $t('about.usersTitle') }}</h3>
          <p>{{ $t('about.usersDescription') }}</p>
        </div>

        <div class="attribution-section">
          <h3>{{ $t('about.tvdbTitle') }}</h3>
          <p>{{ $t('about.tvdbDescription') }}</p>
        </div>

        <div class="attribution-section">
          <h3>{{ $t('about.tmdbTitle') }}</h3>
          <p>{{ $t('about.tmdbDescription') }}</p>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue';
</script>

<style scoped>
.about-container {
  max-width: 100%;
  margin: 0 auto;
}

.about-container h2 {
  color: var(--ion-color-primary);
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
  font-weight: 600;
}

.attribution-section {
  margin-bottom: 2rem;
  padding: 1rem;
  background: var(--ion-color-light);
  border-radius: 8px;
  border-left: 4px solid var(--ion-color-primary);
}

.attribution-section h3 {
  color: var(--ion-color-primary);
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.attribution-section p {
  color: var(--ion-color-medium);
  line-height: 1.6;
  margin: 0;
}

.ion-padding {
  padding: 1rem;
}

/* Mobile-first responsive design */
@media (min-width: 768px) {
  .about-container {
    max-width: 600px;
  }

  .ion-padding {
    padding: 2rem;
  }
}
</style>
