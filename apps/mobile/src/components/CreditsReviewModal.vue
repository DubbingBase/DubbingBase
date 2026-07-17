<template>
  <AppModal :is-open="isOpen" @didDismiss="closeModal">
    <ion-header>
      <ion-toolbar>
        <ion-title>Review Credits</ion-title>
        <ion-buttons slot="end">
          <AppButton @click="closeModal">
            <XCircle class="app-icon" />
          </AppButton>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div v-if="isProcessing" class="ion-text-center">
        <LoadingSpinner />
        <p>Auto-matching with database...</p>
      </div>
      <div v-else>
        <AppList>
          <AppListItem v-for="(credit, index) in processedCredits" :key="index">
            <AppLabel class="ion-text-wrap">
              <h2>
                <strong>Actor:</strong> 
                {{ credit.matchedActorName || credit.actor || 'Not found' }}
                <ion-badge :color="credit.matchedActorId ? 'success' : 'warning'" v-if="credit.actor">
                  {{ credit.matchedActorId ? "Matched" : "Unmatched" }}
                </ion-badge>
              </h2>
              <p><strong>Role:</strong> {{ credit.role || 'Unspecified' }}</p>
              <p>
                <strong>Voice Actor:</strong> 
                {{ credit.matchedVoiceActor ? `${credit.matchedVoiceActor.firstname} ${credit.matchedVoiceActor.lastname}` : credit.voiceActor }}
                <ion-badge
                  :color="credit.matchedVoiceActor ? 'success' : 'warning'"
                >
                  {{ credit.matchedVoiceActor ? "Matched" : "New" }}
                </ion-badge>
              </p>
            </AppLabel>
            <AppButton
              slot="end"
              fill="clear"
              color="danger"
              @click="removeCredit(index)"
            >
              <Trash2 class="app-icon" />
            </AppButton>
          </AppListItem>
        </AppList>

        <div class="ion-padding-top">
          <AppButton
            expand="block"
            :disabled="isSaving || processedCredits.length === 0"
            @click="saveAll"
          >
            <LoadingSpinner v-if="isSaving" :inline="true" />
            Save {{ processedCredits.length }} Credits
          </AppButton>
        </div>
      </div>
    </ion-content>
  </AppModal>
</template>

<script setup lang="ts">
import { toastController } from '@/composables/useToast';
import AppModal from '@/components/common/AppModal.vue';
import AppList from '@/components/common/AppList.vue';
import AppListItem from '@/components/common/AppListItem.vue';
import AppLabel from '@/components/common/AppLabel.vue';
import AppButton from '@/components/common/AppButton.vue';
import { ref, watch } from "vue";
import { IonButtons, 
  
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonBadge,
  } from '@ionic/vue';
import XCircle from "~icons/lucide/x-circle";
import Trash2 from "~icons/lucide/trash-2";
import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import { supabase } from "@/api/supabase";

const props = defineProps<{
  isOpen: boolean;
  extractedCredits: Array<{ actor: string; role: string; voiceActor: string; matchedActorId?: number | null }>;
  movieActors?: Array<any>;
  mediaId: string;
  workType: string;
}>();

const emit = defineEmits<{
  close: [];
  refresh: [];
}>();

const isProcessing = ref(false);
const isSaving = ref(false);

interface ProcessedCredit {
  actor: string;
  role: string;
  voiceActor: string;
  matchedVoiceActor: any | null;
  matchedActorId: number | null;
  matchedActorName: string | null;
}

const processedCredits = ref<ProcessedCredit[]>([]);

watch(
  () => props.isOpen,
  async (isOpen) => {
    if (isOpen && props.extractedCredits.length > 0) {
      await processExtractedCredits();
    } else {
      processedCredits.value = [];
    }
  },
);

const processExtractedCredits = async () => {
  isProcessing.value = true;
  processedCredits.value = [];

  for (const credit of props.extractedCredits) {
    // 1. Try to find the original actor ID from props.movieActors
    let matchedActorId: number | null = null;
    let matchedActorName: string | null = null;
    
    if (credit.matchedActorId && props.movieActors) {
      matchedActorId = credit.matchedActorId;
      const found = props.movieActors.find((ma) => ma.id === matchedActorId);
      if (found) {
        matchedActorName = found.name;
      }
    } 
    
    if (!matchedActorId && credit.actor && credit.actor.trim() !== "" && props.movieActors && props.movieActors.length > 0) {
      // Basic matching by name
      const found = props.movieActors.find((ma) =>
        ma.name?.toLowerCase().includes(credit.actor.trim().toLowerCase()),
      );
      if (found) {
        matchedActorId = found.id;
        matchedActorName = found.name;
      }
    }

    // 2. Try to find the voice actor in DB
    let matchedVoiceActor = null;
    if (credit.voiceActor && credit.voiceActor.trim() !== "") {
      const parts = credit.voiceActor.trim().split(" ");
      const firstname = parts[0];
      const lastname = parts.slice(1).join(" ");

      const { data, error } = await supabase
        .from("voice_actors")
        .select("id, firstname, lastname")
        .ilike("firstname", firstname)
        .ilike("lastname", lastname || "%")
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        matchedVoiceActor = data;
      }
    }

    processedCredits.value.push({
      ...credit,
      matchedVoiceActor,
      matchedActorId,
      matchedActorName});
  }

  isProcessing.value = false;
};

const removeCredit = (index: number) => {
  processedCredits.value.splice(index, 1);
};

const saveAll = async () => {
  isSaving.value = true;
  let successCount = 0;

  try {
    for (const credit of processedCredits.value) {
      let vaId = credit.matchedVoiceActor?.id;

      // Create voice actor if not matched
      if (!vaId) {
        const parts = credit.voiceActor.trim().split(" ");
        const firstname = parts[0];
        const lastname = parts.slice(1).join(" ");

        const { data: newVa, error: vaError } = await supabase
          .from("voice_actors")
          .insert({ firstname, lastname })
          .select("id")
          .single();

        if (vaError) {
          console.error("Failed to create voice actor:", vaError);
          continue;
        }
        vaId = newVa.id;
      }

      // Link voice actor
      const { error: linkError } = await supabase.functions.invoke(
        "link-voice-actor",
        {
          body: {
            actor_id: credit.matchedActorId || null,
            media_type: props.workType,
            voice_actor_id: vaId,
            performance: credit.role || "dialogues",
            media_id: props.mediaId}},
      );

      if (!linkError) {
        successCount++;
      }
    }

    const toast = await toastController.create({
      message: `Successfully saved ${successCount} voice actors!`,
      duration: 3000,
      color: "success",
      position: "top"});
    await toast.present();

    emit("refresh");
    closeModal();
  } catch (error) {
    console.error("Error saving credits:", error);
    const toast = await toastController.create({
      message: "An error occurred while saving credits.",
      duration: 3000,
      color: "danger",
      position: "top"});
    await toast.present();
  } finally {
    isSaving.value = false;
  }
};

const closeModal = () => {
  emit("close");
};
</script>

<style scoped>
.app-icon {
  width: 24px;
  height: 24px;
}
</style>
