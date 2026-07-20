<template>
  <ion-page>
    <div class="base-layout">
      <div class="content">
        <ion-router-outlet />
      </div>
    </div>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonRouterOutlet } from "@ionic/vue";
defineOptions({ name: 'TabsPage' });
</script>

<style scoped>
.base-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--app-background-color, rgb(28, 28, 29));
}

.content {
  flex: 1;
  overflow: auto;
  position: relative;
}
</style>
