<template>
  <div class="no-voice-actor">
    <div class="voice-actor-container">
      <div class="voice-actor">
        <AppImage class="app-thumbnail" class="avatar">
          <img src="https://placehold.co/48x72?text=?" alt="No photo" />
        </AppImage>
        <AppText class="line-label">
          <span class="ellipsis label">
            No voice actor found.
          </span>
          <AppButton v-if="isAdmin" fill="clear" size="small" @click.stop="openVoiceActorSearch(actor.id)" class="add-voice-actor-btn">
            <UserPlus class="app-icon" />
            Add
          </AppButton>
        </AppText>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AppButton from '@/components/common/AppButton.vue';
import AppImage from '@/components/common/AppImage.vue';
import AppText from '@/components/common/AppText.vue';
import UserPlus from '~icons/lucide/user-plus';
import AppSpinner from '@/components/common/AppSpinner.vue';
import AppSkeleton from '@/components/common/AppSkeleton.vue';



// Props
defineProps<{
  actor: any;
  isAdmin: boolean;
  openVoiceActorSearch: (actor: any) => void;
}>();
</script>

<style scoped lang="scss">
.avatar {
  --border-radius: 4px;
  width: 48px;
  height: auto;
  min-height: 72px;
  flex: 1 0 auto;
}

.line-label {
  margin-left: 8px;
  width: 100%;
  display: flex;
  justify-content: space-between;

  .label {
    width: 100%;
    display: block;
  }
}

.voice-actor-container {
  width: 100%;
}

.voice-actor {
  background-color: #666;
  flex: 1 0 auto;
  width: 100%;
  display: flex;
  flex-direction: row;
  gap: 4px;
  border-radius: 4px;
  padding: 4px;
}

.no-voice-actor {
  color: var(--ion-color-medium);
  font-style: italic;
  text-align: center;
  display: flex;
  justify-content: space-between;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.add-voice-actor-btn {
  --padding-start: 12px;
  --padding-end: 12px;
  --padding-top: 8px;
  --padding-bottom: 8px;
  font-size: 0.85rem;
  height: auto;
  margin-top: 4px;
}

.add-voice-actor-btn .app-icon {
  margin-right: 4px;
}
</style>
