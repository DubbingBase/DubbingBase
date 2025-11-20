<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button :default-href="{ name: 'Home' }" />
        </ion-buttons>
        <ion-title>Voix</ion-title>
        <ion-buttons slot="end" v-if="isAdmin">
          <router-link :to="{ name: 'EditVoiceActor', params: { id: voiceActor?.id } }">
            <ion-button size="small" color="primary">Edit</ion-button>
          </router-link>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <LoadingSpinner
        v-if="loading"
        :overlay="true"
        text="Loading voice actor..."
      />

      <div v-if="!loading && voiceActor" class="actor">
        <VoiceActorHeader
          :voiceActor="voiceActor"
          :profilePicture="profilePicture"
          @profile-picture-changed="onProfilePictureChanged"
        />

        <VoiceActorBio
          :bio="voiceActor.bio"
        />

        <VoiceActorWorksGrouped
          :works="enhancedWork"
        />
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
// Admin check: get user from supabase.auth and check for admin role
import type { Serie as SerieModel } from "../../supabase/functions/_shared/serie";
import {
  IonPage,
  IonButton,
  IonBackButton,
  IonButtons,
  IonTitle,
  IonToolbar,
  IonContent,
  IonHeader,
} from "@ionic/vue";
import type { Movie as MovieModel } from "../../supabase/functions/_shared/movie";
import { supabase } from "../api/supabase";
import VoiceActorHeader from "@/components/VoiceActorHeader.vue";
import VoiceActorBio from "@/components/VoiceActorBio.vue";
import VoiceActorWorksGrouped from "@/components/VoiceActorWorksGrouped.vue";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import { storeToRefs } from 'pinia';
import { useAuthStore } from '@/stores/auth';
import { PersonData } from "@/components/PersonItem.vue";
import { Actor } from "../../supabase/functions/_shared/types";
import { actorToPersonData } from "@/utils/convert";

const authStore = useAuthStore();
const route = useRoute();

// Local admin check using Supabase auth

const { isAdmin } = storeToRefs(authStore);


type VoiceActorResponse = {
  voiceActor: {
    id: number;
    firstname: string;
    lastname: string;
    bio: string | null;
    nationality: string | null;
    date_of_birth: string | null;
    awards: string | null;
    years_active: string | null;
    social_media_links: any | null;
    profile_picture: string | null;
    voice_actor_name: string | null;
    work: {
      id: number;
      actor_id: number;
      content_id: number;
      content_type: string | null;
      highlight: boolean | null;
      performance: string | null;
      source_id: number | null;
      status: string | null;
      suggestions: string | null;
      voice_actor_id: number | null;
    }[];
  };
  medias: (MovieModel | SerieModel)[];
};

const voiceActor = ref<VoiceActorResponse["voiceActor"] | undefined>();
const medias = ref<VoiceActorResponse["medias"]>([]);
const profilePicture = ref<string | null | undefined>();
const loading = ref<boolean>(true);

// Define a type for our enhanced work item
type EnhancedWorkItem = {
  media: MovieModel | SerieModel;
  work: { id: number; actor_id: number; content_id: number };
  data: {
    character: string | undefined;
    actor: PersonData<Actor>;
  };
  sortDate: string;
};

// Get base enhanced work data
const baseEnhancedWork = computed<EnhancedWorkItem[]>(() => {
  if (!voiceActor.value?.work) {
    console.log('No voice actor work data available');
    return [];
  }

  const result = voiceActor.value.work
    .map((work) => {
      const media = medias.value.find((media) => media.id === work.content_id);

      if (!media) {
        console.warn(`No media found for work with content_id: ${work.content_id}`);
        return null;
      }

      // Ensure credits exist and has cast
      if (!(media as any).credits?.cast) {
        console.warn(`No credits.cast found for media ${media.id}`);
        return null;
      }

      const actor = (media as any).credits.cast.find((cast: any) => cast.id === work.actor_id);

      if (!actor) {
        console.warn(`No actor found with id: ${work.actor_id} in media ${media.id}`);
        return null;
      }

      const character = actor.character;
      const data = {
        character,
        actor: actorToPersonData(actor),
      };

      return {
        media,
        work,
        data,
        sortDate: (media as any).release_date || (media as any).first_air_date || '9999-12-31' // Fallback for missing dates
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return result;
});

// For chronological view
const enhancedWork = computed(() => {
  if (!baseEnhancedWork.value) return [];

  return [...baseEnhancedWork.value].sort((a, b) => {
    if (!a || !b) return 0;
    return a.sortDate > b.sortDate ? -1 : 1; // Newest first
  });
});

const onProfilePictureChanged = (newImagePath: string) => {
  console.log('Profile picture changed:', newImagePath);
  profilePicture.value = newImagePath;

  // Update the voice actor's profile picture as well
  if (voiceActor.value) {
    voiceActor.value.profile_picture = newImagePath;
    console.log('Updated voiceActor profile_picture:', voiceActor.value.profile_picture);
  }
};

onMounted(async () => {
  loading.value = true;

  const id = route.params.id;

  console.log('Fetching voice actor with ID:', id);

  const voiceActorResponseRaw = await supabase.functions.invoke("voice-actor", {
    body: { id },
  });

  const voiceActorResponse = (await voiceActorResponseRaw.data) as VoiceActorResponse;

  console.log("Raw voice actor response:", voiceActorResponse);

  if (!voiceActorResponse) {
    console.error("voiceActorResponse is null");
    loading.value = false;
    return;
  }

  console.log('Voice actor data:', voiceActorResponse.voiceActor);
  console.log('Number of works:', voiceActorResponse.voiceActor.work?.length || 0);
  console.log('Number of medias:', voiceActorResponse.medias?.length || 0);

  // Log first few works and medias for inspection
  if (voiceActorResponse.voiceActor.work) {
    console.log('First 3 works:', voiceActorResponse.voiceActor.work.slice(0, 3));
  }

  if (voiceActorResponse.medias) {
    console.log('First 3 medias:', voiceActorResponse.medias.slice(0, 3).map(m => ({
      id: m.id,
      title: (m as any).title || (m as any).name,
      credits: (m as any).credits ? {
        cast: (m as any).credits.cast?.slice(0, 3).map((c: any) => ({ id: c.id, name: c.name, character: c.character })),
        crew: (m as any).credits.crew?.slice(0, 3).map((c: any) => ({ id: c.id, name: c.name, job: c.job }))
      } : 'No credits'
    })));
  }

  voiceActor.value = voiceActorResponse.voiceActor;
  medias.value = voiceActorResponse.medias;

  profilePicture.value = voiceActorResponse.voiceActor.profile_picture;

  loading.value = false;

  // Add a small delay to ensure computed properties are updated
  setTimeout(() => {
    console.log('baseEnhancedWork after update:', baseEnhancedWork.value);
    console.log('enhancedWork after update:', enhancedWork.value);
  }, 100);
});

</script>

<style scoped lang="scss">
.actor {
  padding: 16px;
  margin: 0 auto;
}
</style>
