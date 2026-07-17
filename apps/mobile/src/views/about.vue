<template>
  <AppPage>
    <AppHeader>
      <AppToolbar>
        <template #start >
          <AppBackButton />
        </template>
        <AppTitle>{{ $t('about.title') }}</AppTitle>
      </AppToolbar>
    </AppHeader>
    <AppContent class="ion-padding">
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
    </AppContent>
  </AppPage>
</template>

<script setup lang="ts">
import AppPage from '@/components/common/layout/AppPage.vue';
import AppHeader from '@/components/common/layout/AppHeader.vue';
import AppToolbar from '@/components/common/layout/AppToolbar.vue';
import AppTitle from '@/components/common/layout/AppTitle.vue';
import AppContent from '@/components/common/layout/AppContent.vue';
import AppBackButton from "@/components/common/AppBackButton.vue";
</script>

<style scoped>
.about-container {
  max-width: 100%;
  margin: 0 auto;
}

.about-container h2 {
  color: #e0e0e0;
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
  font-weight: 600;
}

.attribution-section {
  margin-bottom: 2rem;
  padding: 1rem;
  background: #1d1d1d;
  border-radius: 8px;
  border: 1px solid #2a2a2a;
  border-left: 4px solid #4da8ff;
}

.attribution-section h3 {
  color: #e0e0e0;
  margin-bottom: 0.5rem;
  font-size: 1.1rem;
  font-weight: 600;
}

.attribution-section p {
  color: #a0a0a0;
  line-height: 1.6;
  margin: 0;
}

.app-padding {
  padding: 1rem;
}

/* Mobile-first responsive design */
@media (min-width: 768px) {
  .about-container {
    max-width: 600px;
  }

  .app-padding {
    padding: 2rem;
  }
}
</style>
