<template>
  <div class="va-actor" v-if="modelValue">
    <router-link
      :to="{
        name: 'voice-actor-details',
        params: {
          id: voiceActorId,
        },
      }"
    >
      <img class="profile-img" :src="getAvatarFallbackUrl(fullName)" alt="" />
      <div>
        {{ firstname }}
        {{ lastname }}
        {{ performance }}
      </div>
    </router-link>
  </div>
  <div v-else class="va-actor">
    <AppImage class="app-thumbnail avatar" slot="start">
      <img :src="getAvatarFallbackUrl('Unknown')" />
    </AppImage>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import type { WorkAndVoiceActor } from "@supabase/functions/_shared/types";
import { getAvatarFallbackUrl } from "@/utils/image";

const props = defineProps<{
  modelValue: WorkAndVoiceActor | undefined;
}>();

const firstname = computed(() => {
  return props.modelValue?.voiceActorDetails.firstname;
});

const lastname = computed(() => {
  return props.modelValue?.voiceActorDetails.lastname;
});

const performance = computed(() => {
  return props.modelValue?.performance;
});

const voiceActorId = computed(() => {
  return props.modelValue?.voiceActorDetails.id;
});

const fullName = computed(() => {
  return `${firstname.value} ${lastname.value}`;
});
</script>

<style lang="scss" scoped>
.avatar {
  --border-radius: 4px;
  width: 48px;
  height: auto;
  min-height: 72px;
}
</style>
