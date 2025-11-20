<template>
  <div class="va-actor" v-if="modelValue">
    <router-link
      :to="{
        name: 'VoiceActorDetails',
        params: {
          id: voiceActorId,
        },
      }"
    >
      <img
        class="profile-img"
        :src="`https://api.dicebear.com/7.x/initials/svg?seed=${fullName}`"
        alt=""
      />
      <div>
        {{ firstname }}
        {{ lastname }}
        {{ performance }}
      </div>
    </router-link>
  </div>
  <div v-else class="va-actor">
    <ion-thumbnail class="avatar" slot="start">
      <img src="https://placehold.co/48x72?text=?" />
    </ion-thumbnail>
  </div>
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { WorkAndVoiceActor } from "../../supabase/functions/_shared/movie";

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
