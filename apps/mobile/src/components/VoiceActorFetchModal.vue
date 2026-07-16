<template>
  <ion-modal :is-open="isOpen" @didDismiss="handleDismiss">
    <ion-header>
      <ion-toolbar>
        <ion-title>{{
          t("voiceActor.fetchWikipedia", "Fetch Wikipedia")
        }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="handleDismiss">
            <XCircle class="app-icon" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <div class="step-container">
        <p class="description">
          {{
            t(
              "voiceActor.enterWikipediaUrlDesc",
              "Enter a Wikipedia URL to fetch the voice actor's biography, name, and profile picture. You can also manually fill the details below.",
            )
          }}
        </p>
        <div class="input-group">
          <ion-input
            v-model="wikipediaUrl"
            :placeholder="t('voiceActor.wikipediaUrl', 'Wikipedia URL')"
            class="url-input"
          ></ion-input>
          <ion-button
            v-if="wikipediaUrl"
            fill="clear"
            @click="openLink"
            class="open-link-btn"
          >
            <ExternalLink class="app-icon" />
          </ion-button>
        </div>

        <ion-button
          expand="block"
          @click="fetchData"
          :disabled="!wikipediaUrl || isFetching"
          class="ion-margin-top ion-margin-bottom"
        >
          <LoadingSpinner v-if="isFetching" :inline="true" />
          <span v-else>{{ t("common.fetch", "Fetch & Override") }}</span>
        </ion-button>



        <ion-list class="diff-list" lines="none">
          <!-- Firstname -->
          <div class="diff-item">
                          <div class="label-header">
                <span>FIRSTNAME</span>
                <span class="old-value-hint">Current: {{ voiceActor?.firstname || 'None' }}</span>
              </div>
                        <div class="input-with-action">
              <ion-input v-model="fetchedData.firstname" class="styled-input"></ion-input>
              <ion-button fill="clear" @click="fetchedData.firstname = voiceActor?.firstname || ''">
                <Undo2 class="app-icon" />
              </ion-button>
            </div>
          </div>

          <!-- Lastname -->
          <div class="diff-item">
                          <div class="label-header">
                <span>LASTNAME</span>
                <span class="old-value-hint">Current: {{ voiceActor?.lastname || 'None' }}</span>
              </div>
                        <div class="input-with-action">
              <ion-input v-model="fetchedData.lastname" class="styled-input"></ion-input>
              <ion-button fill="clear" @click="fetchedData.lastname = voiceActor?.lastname || ''">
                <Undo2 class="app-icon" />
              </ion-button>
            </div>
          </div>

          <!-- Date of Birth -->
          <div class="diff-item">
                          <div class="label-header">
                <span>DATE OF BIRTH</span>
                <span class="old-value-hint">Current: {{ voiceActor?.date_of_birth || 'None' }}</span>
              </div>
                        <div class="input-with-action">
              <ion-input v-model="fetchedData.date_of_birth" class="styled-input"></ion-input>
              <ion-button fill="clear" @click="fetchedData.date_of_birth = voiceActor?.date_of_birth || ''">
                <Undo2 class="app-icon" />
              </ion-button>
            </div>
          </div>

          <!-- TMDB ID -->
          <div class="diff-item">
                          <div class="label-header">
                <span>TMDB ID</span>
                <span class="old-value-hint">Current: {{ voiceActor?.tmdb_id || 'None' }}</span>
              </div>
                        <div class="input-with-action">
              <ion-input v-model="fetchedData.tmdb_id" type="number" class="styled-input"></ion-input>
              <ion-button fill="clear" @click="fetchedData.tmdb_id = voiceActor?.tmdb_id || null">
                <Undo2 class="app-icon" />
              </ion-button>
              <ion-button fill="clear" :href="fetchedData.tmdb_id ? `https://www.themoviedb.org/person/${fetchedData.tmdb_id}` : undefined" target="_blank" :disabled="!fetchedData.tmdb_id">
                <ExternalLink class="app-icon" />
              </ion-button>
            </div>
          </div>

          <!-- Bio -->
          <div class="diff-item">
                          <div class="label-header">
                <span>BIO</span>
              </div>
                        <div class="old-bio-hint" v-if="voiceActor?.bio">Current: {{ voiceActor.bio }}</div>
            <div class="input-with-action bio-action">
              <ion-textarea v-model="fetchedData.bio" auto-grow :rows="4" class="styled-input"></ion-textarea>
              <ion-button fill="clear" @click="fetchedData.bio = voiceActor?.bio || ''" class="align-top-btn">
                <Undo2 class="app-icon" />
              </ion-button>
            </div>
          </div>

          <!-- Profile Picture -->
          <div class="diff-item">
                          <div class="label-header">
                <span>PROFILE PICTURE</span>
              </div>
                        <div class="image-diff-stacked">
              <div class="images-preview">
                <div class="img-preview">
                  <span class="preview-label">Current</span>
                  <img v-if="voiceActor?.profile_picture && voiceActor.profile_picture.trim() !== ''" :src="voiceActor.profile_picture" />
                  <div v-else class="no-image">No Image</div>
                </div>
                <ArrowRight class="app-icon" />
                <div class="img-preview new-img-preview">
                  <span class="preview-label">New</span>
                  <img v-if="fetchedData.profile_picture && fetchedData.profile_picture.trim() !== ''" :src="fetchedData.profile_picture" />
                  <div v-else class="no-image">No Image</div>
                </div>
              </div>
              <div style="display: flex; justify-content: center; width: 100%;">
                <ion-button fill="clear" @click="fetchedData.profile_picture = voiceActor?.profile_picture || ''">
                  <Undo2 class="app-icon" />
                  Keep Current Image
                </ion-button>
              </div>
            </div>
          </div>
        </ion-list>

        <div v-if="error" class="error-message ion-margin-top">
          {{ error }}
        </div>

        <div class="action-buttons ion-margin-top ion-padding-bottom">
          <ion-button
            fill="outline"
            color="medium"
            @click="handleDismiss"
            :disabled="isSaving"
          >
            {{ t("common.cancel", "Cancel") }}
          </ion-button>
          <ion-button @click="saveData" :disabled="isSaving">
            <LoadingSpinner v-if="isSaving" :inline="true" />
            <span v-else>{{ t("common.save", "Save") }}</span>
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import Undo2 from '~icons/lucide/undo2';
import ArrowRight from '~icons/lucide/arrow-right';
import XCircle from '~icons/lucide/x-circle';
import ExternalLink from '~icons/lucide/external-link';
import { ref, watch } from "vue";
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonInput, IonTextarea, IonList, IonItem } from '@ionic/vue';

import LoadingSpinner from "@/components/common/LoadingSpinner.vue";
import { supabase } from "@/api/supabase";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

const props = defineProps<{
  isOpen: boolean;
  voiceActor: any;
  potentialWikipediaUrl: string | null;
}>();

const emit = defineEmits<{
  close: [];
  saved: [];
}>();

const wikipediaUrl = ref("");
const isFetching = ref(false);
const isSaving = ref(false);
const error = ref("");
const fetchedData = ref<any>({});

watch(
  () => props.isOpen,
  (newVal) => {
    if (newVal) {
      wikipediaUrl.value = props.potentialWikipediaUrl || "";
      error.value = "";
      fetchedData.value = {
        firstname: props.voiceActor?.firstname || "",
        lastname: props.voiceActor?.lastname || "",
        bio: props.voiceActor?.bio || "",
        profile_picture: props.voiceActor?.profile_picture || "",
        date_of_birth: props.voiceActor?.date_of_birth || "",
        wikidata_id: props.voiceActor?.wikidata_id || null,
        tmdb_id: props.voiceActor?.tmdb_id || null,
      };
    }
  },
);

const handleDismiss = () => {
  if (!isFetching.value && !isSaving.value) {
    emit("close");
  }
};

const openLink = () => {
  if (wikipediaUrl.value) {
    window.open(wikipediaUrl.value, "_blank");
  }
};



const fetchData = async () => {
  if (!wikipediaUrl.value) return;

  isFetching.value = true;
  error.value = "";

  try {
    const { data, error: funcError } = await supabase.functions.invoke(
      "extract-voice-actor-info",
      {
        body: { wikipediaUrl: wikipediaUrl.value },
      },
    );

    if (funcError) throw funcError;
    if (!data || !data.ok)
      throw new Error(data?.error || "Failed to extract data");

    // Merge existing and new data
    fetchedData.value = {
      firstname: data.result.firstname || props.voiceActor?.firstname || "",
      lastname: data.result.lastname || props.voiceActor?.lastname || "",
      bio: data.result.bio || props.voiceActor?.bio || "",
      profile_picture:
        data.result.profile_picture || props.voiceActor?.profile_picture || "",
      date_of_birth:
        data.result.date_of_birth || props.voiceActor?.date_of_birth || "",
      wikidata_id:
        data.result.wikidata_id || props.voiceActor?.wikidata_id || null,
      tmdb_id:
        data.result.tmdb_id || props.voiceActor?.tmdb_id || null,
    };
  } catch (err: any) {
    console.error("Error fetching wikipedia data:", err);
    error.value = err.message || "An error occurred while fetching data.";
  } finally {
    isFetching.value = false;
  }
};

const saveData = async () => {
  if (!props.voiceActor?.id) return;

  isSaving.value = true;
  error.value = "";

  try {
    const updates = {
      firstname: fetchedData.value.firstname,
      lastname: fetchedData.value.lastname,
      bio: fetchedData.value.bio,
      profile_picture: fetchedData.value.profile_picture,
      date_of_birth: fetchedData.value.date_of_birth,
      wikidata_id: fetchedData.value.wikidata_id,
      tmdb_id: fetchedData.value.tmdb_id,
    };

    const { data, error: updateError } = await supabase.functions.invoke(
      "update-voice-actor",
      {
        body: {
          voice_actor_id: props.voiceActor.id,
          updates,
        },
      },
    );

    if (updateError) throw updateError;

    emit("saved");
    emit("close");
  } catch (err: any) {
    console.error("Error saving voice actor:", err);
    error.value = err.message || "An error occurred while saving.";
  } finally {
    isSaving.value = false;
  }
};
</script>

<style scoped lang="scss">
.step-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.description {
  color: var(--ion-text-color);
  opacity: 0.7;
  font-size: 0.95rem;
  margin-bottom: 1.5rem;
}

.input-group {
  display: flex;
  align-items: center;
  background: var(--ion-color-light, #f4f5f8);
  border-radius: 8px;

  .url-input {
    flex: 1;
    --padding-start: 12px;
  }

  .open-link-btn {
    margin: 0;
    --padding-start: 8px;
    --padding-end: 8px;
  }
}

.error-message {
  color: var(--ion-color-danger);
  margin-top: 1rem;
  font-size: 0.9rem;
  background: rgba(var(--ion-color-danger-rgb), 0.1);
  padding: 8px 12px;
  border-radius: 6px;
}

.diff-list {
  background: transparent;
  padding: 0;
}

.diff-item {
  background: var(--ion-color-light);
  border-radius: 12px;
  margin-bottom: 16px;
  padding: 12px 16px 16px 16px;
  display: flex;
  flex-direction: column;
}

.label-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  font-size: 0.85rem;
  letter-spacing: 0.05em;
  font-weight: 700;
  color: var(--ion-color-primary);
  margin-bottom: 8px;
}

.old-value-hint {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  font-weight: 500;
  text-transform: none;
  opacity: 1;
  max-width: 100%;
  display: block;
  margin-top: 4px;
}

.old-bio-hint {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
  margin-bottom: 8px;
  opacity: 0.8;
  font-style: italic;
}

.input-with-action {
  display: flex;
  align-items: center;
  width: 100%;
  background: var(--ion-background-color, #fff);
  border: 1px solid var(--ion-color-primary);
  border-radius: 8px;
  padding-right: 4px;
  overflow: hidden;
}

.bio-action {
  align-items: flex-start;
}

.align-top-btn {
  margin-top: 8px;
}

.styled-input {
  --padding-start: 12px;
  --padding-end: 8px;
  flex: 1;
}

.image-diff-stacked {
  width: 100%;
  display: flex;
  flex-direction: column;
  margin-top: 12px;
}

.images-preview {
  display: flex;
  align-items: center;
  justify-content: space-around;
  margin-bottom: 12px;
}

.img-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  
  img, .no-image {
    width: 90px;
    height: 90px;
    border-radius: 50%;
    object-fit: cover;
    border: 3px solid var(--ion-color-step-100, rgba(0,0,0,0.05));
  }
  .no-image {
    background: var(--ion-color-step-100, rgba(0,0,0,0.05));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    color: var(--ion-color-medium);
  }
}

.new-img-preview img {
  border-color: var(--ion-color-primary);
}

.preview-label {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--ion-color-medium);
}

.diff-arrow-stacked {
  font-size: 1.5rem;
  color: var(--ion-color-medium);
  opacity: 0.5;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;

  ion-button {
    margin: 0;
  }
}

</style>
