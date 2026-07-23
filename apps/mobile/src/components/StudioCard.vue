<template>
  <router-link :to="`/studio/${studio.id || encodeURIComponent(studio.name)}`" class="no-link">
    <div class="studio-card">
      <div class="studio-logo" :class="{ 'no-image': !studio.logo_url }">
        <img v-if="studio.logo_url" :src="studio.logo_url" :alt="studio.name" />
        <Building2 v-else class="fallback-icon" />
      </div>
      <div class="studio-info">
        <div class="studio-name">{{ studio.name }}</div>
        <div v-if="studio.city || studio.country" class="studio-location">
          <MapPin class="location-icon" />
          <span>{{ [studio.city, studio.country].filter(Boolean).join(', ') }}</span>
        </div>
      </div>
      <div class="studio-action">
        <ChevronRight class="action-icon" />
      </div>
    </div>
  </router-link>
</template>

<script setup lang="ts">
import Building2 from '~icons/lucide/building-2';
import MapPin from '~icons/lucide/map-pin';
import ChevronRight from '~icons/lucide/chevron-right';

export interface Studio {
  id: number;
  name: string;
  city?: string;
  country?: string;
  logo_url?: string;
  [key: string]: any;
}

defineProps<{
  studio: Studio;
}>();
</script>

<style scoped lang="scss">
.no-link {
  text-decoration: none;
  display: block;
}

.studio-card {
  display: flex;
  align-items: center;
  background: var(--ion-color-step-50, #1e1e1e);
  border: 1px solid var(--ion-color-step-150, #2c2c2c);
  border-radius: 12px;
  padding: 12px;
  transition: all 0.2s ease;

  &:hover, &:active {
    background: var(--ion-color-step-100, #2a2a2a);
    border-color: var(--ion-color-step-200, #3a3a3a);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
}

.studio-logo {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--app-color-step-200);
  flex-shrink: 0;
  margin-right: 16px;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #ffffff; /* Typically logos have white backgrounds if not transparent */
  }

  &.no-image {
    background: var(--ion-color-primary-tint, #3b82f6);
    color: #ffffff;
  }
}

.fallback-icon {
  width: 24px;
  height: 24px;
}

.studio-info {
  flex: 1;
  min-width: 0;
}

.studio-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--ion-color-step-850, #e0e0e0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.studio-location {
  display: flex;
  align-items: center;
  font-size: 13px;
  color: var(--ion-color-medium, #92949c);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  .location-icon {
    width: 12px;
    height: 12px;
    margin-right: 4px;
    flex-shrink: 0;
  }
}

.studio-action {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ion-color-medium, #92949c);
  padding-left: 12px;

  .action-icon {
    width: 20px;
    height: 20px;
  }
}
</style>
