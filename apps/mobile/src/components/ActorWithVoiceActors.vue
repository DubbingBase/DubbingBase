<template>
  <div class="actor-with-voice-actors">
    <!-- Character Name -->
    <div class="character-name">
      <div
        class="name"
        v-for="(role, index) in actor.roles"
        :key="role.character"
      >
        {{ index > 0 ? "/ " : "" }} {{ role.character }}
      </div>
    </div>

    <!-- Main Actor Display -->
    <div class="main-actor">
      <PersonItem :person="actor" type="actor">
        <template #actions>
          <ion-button
            v-if="
              voiceActors.length === 0 &&
              shouldShowVoiceActors &&
              hasPermission('add_voice_actors')
            "
            fill="clear"
            size="small"
            @click.prevent.stop="
              openVoiceActorSearch && openVoiceActorSearch(actor.id)
            "
            aria-label="Add voice actor link"
          >
            <ion-icon :icon="addCircle"></ion-icon>
          </ion-button>
        </template>
      </PersonItem>
    </div>

    <!-- Voice Actors List -->
    <div
      v-if="voiceActors && voiceActors.length && shouldShowVoiceActors"
      class="voice-actors-section"
    >
      <div class="voice-actors-scroll">
        <div class="voice-actors-container">
          <template v-for="voiceActor in voiceActors" :key="voiceActor.id">
            <router-link
              class="voice-actor-item no-link"
              :to="{ name: 'VoiceActorDetails', params: { id: voiceActor.id } }"
            >
              <PersonItem
                v-on-long-press.prevent="() => handleLongPress(voiceActor)"
                class="voice-actor-item"
                :person="voiceActor"
                type="voice-actor"
              >
                <template #actions>
                  <!-- Status Indicators -->
                  <ion-icon
                    v-if="voiceActor.reviewed_status === 'accepted'"
                    :icon="checkmarkCircleOutline"
                    class="status-icon accepted"
                    size="small"
                  ></ion-icon>
                  <ion-icon
                    v-if="voiceActor.reviewed_status === 'waiting'"
                    :icon="timeOutline"
                    class="status-icon waiting"
                    size="small"
                  ></ion-icon>
                </template>
              </PersonItem>
            </router-link>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import PersonItem, { PersonData } from "./PersonItem.vue";
import {
  createOutline,
  trashOutline,
  addCircle,
  thumbsUpOutline,
  thumbsDownOutline,
  timeOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
} from "ionicons/icons";
import { useLanguagePreference } from "@/composables/useLanguagePreference";
import { computed, watch } from "vue";
import { vOnLongPress } from "@vueuse/components";

import { IonIcon, IonButton, actionSheetController } from "@ionic/vue";
import { usePermissions } from "@/composables/usePermissions";
import { useVoiceActorManagement } from "@/composables/useVoiceActorManagement";
import { useAuthStore } from "@/stores/auth";
import { useI18n } from "vue-i18n";
import {
  Actor,
  VoiceActorDetails,
} from "../../supabase/functions/_shared/types";

export interface ActorWithVoiceActorsProps {
  actor: PersonData<Actor>;
  voiceActors?: PersonData<VoiceActorDetails>[];
  onActorClick?: (actor: PersonData<Actor>) => void;
  onVoiceActorClick?: (voiceActor: PersonData<VoiceActorDetails>) => void;
  mediaLanguage?: string;
  editVoiceActorLink?: (workItem: any) => void;
  confirmDeleteVoiceActorLink?: (workItem: any) => void;
  addVoiceActorLink?: (actor: PersonData<Actor>) => void;
  openVoiceActorSearch?: (actorId: number) => void;
  workType?: "movie" | "tv" | "season" | "episode";
  contentId?: string;
}

const props = withDefaults(defineProps<ActorWithVoiceActorsProps>(), {
  voiceActors: () => [],
  onActorClick: () => {},
  onVoiceActorClick: () => {},
  mediaLanguage: () => "",
  editVoiceActorLink: undefined,
  confirmDeleteVoiceActorLink: undefined,
  openVoiceActorSearch: undefined,
  workType: () => "movie",
  contentId: () => "",
});

// Use language preference composable
const { preferredLanguage } = useLanguagePreference();

// Use access control composable
const { hasPermission } = usePermissions();

// Use auth store
const authStore = useAuthStore();

// Use i18n
const { t } = useI18n();

// Use voice actor management composable
const { castVote, votes, refreshVotes, updateReviewStatus } =
  useVoiceActorManagement(props.workType);

// Watch for voice actors changes to refresh votes
watch(
  () => props.voiceActors,
  (newVoiceActors) => {
    if (
      newVoiceActors &&
      newVoiceActors.length > 0 &&
      authStore.isAuthenticated
    ) {
      const workIds = newVoiceActors.map((va) => va.id);
      refreshVotes(workIds);
    }
  },
  { immediate: true }
);

console.log(
  "[ActorWithVoiceActors] canAccess add_voice_actors:",
  hasPermission("add_voice_actors")
);

const shouldShowVoiceActors = computed(() => {
  return (
    props.mediaLanguage.toLowerCase() !== preferredLanguage.value.toLowerCase()
  );
});

function handleLongPress(voiceActor: PersonData) {
  openActionSheet(voiceActor);
}

// Open comprehensive action sheet
const openActionSheet = async (voiceActor: PersonData<VoiceActorDetails>) => {
  const buttons: any[] = [];

  // Review status actions if user has permission
  const canUpdateReviewStatus = hasPermission("admin_fetch");
  if (canUpdateReviewStatus) {
    buttons.push(
      {
        text: `${t("common.setStatus")} - ${t("common.waiting")}`,
        icon: timeOutline,
        handler: async () => {
          await updateReviewStatus(voiceActor.work_id, "waiting");
          // Force a refresh of the component to show updated status
          location.reload();
        },
      },
      {
        text: `${t("common.setStatus")} - ${t("common.accepted")}`,
        icon: checkmarkCircleOutline,
        handler: async () => {
          await updateReviewStatus(voiceActor.work_id, "accepted");
          // Force a refresh of the component to show updated status
          location.reload();
        },
      },
      {
        text: `${t("common.setStatus")} - ${t("common.rejected")}`,
        icon: closeCircleOutline,
        handler: async () => {
          await updateReviewStatus(voiceActor.work_id, "rejected");
          // Force a refresh of the component to show updated status
          location.reload();
        },
      }
    );
  }

  // Vote actions if authenticated
  if (authStore.isAuthenticated) {
    buttons.push(
      {
        text: `${t("common.upvote")} (${
          votes.value[voiceActor.id]?.up_count || 0
        })`,
        icon: thumbsUpOutline,
        handler: () => castVote(voiceActor.id, "up"),
      },
      {
        text: `${t("common.downvote")} (${
          votes.value[voiceActor.id]?.down_count || 0
        })`,
        icon: thumbsDownOutline,
        handler: () => castVote(voiceActor.id, "down"),
      }
    );
  }

  // Admin actions
  if (hasPermission("edit_voice_actor_link")) {
    buttons.push({
      text: t("common.edit"),
      icon: createOutline,
      handler: () => {
        props.editVoiceActorLink &&
          props.editVoiceActorLink({
            id: props.actor.id,
            voiceActorDetails: voiceActor,
          });
      },
    });
  }

  if (hasPermission("delete_voice_actor_link")) {
    buttons.push({
      text: t("common.delete"),
      icon: trashOutline,
      role: "destructive",
      handler: () => {
        props.confirmDeleteVoiceActorLink &&
          props.confirmDeleteVoiceActorLink({
            id: props.actor.id,
            voiceActorDetails: voiceActor,
          });
      },
    });
  }

  // Cancel button
  buttons.push({
    text: t("common.cancel"),
    role: "cancel",
  });

  const actionSheet = await actionSheetController.create({
    header: t("common.actions"),
    buttons,
  });
  await actionSheet.present();
};
</script>

<style scoped lang="scss">
.actor-with-voice-actors {
  display: flex;
  flex-direction: column;
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.02);

  .character-name {
    font-size: 16px;
    font-weight: 600;
    color: #e0e0e0;
    margin-bottom: 8px;
    padding: 4px 8px;
    border-radius: 8px;
    display: flex;
    flex-direction: row;
    gap: 8px;
    overflow: auto;

    .name {
      display: inline-flex;
      flex: 0 0 auto;
    }
  }

  .main-actor {
    width: 100%;
  }

  .voice-actors-section {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .voice-actors-label {
      font-size: 14px;
      font-weight: 600;
      color: #e0e0e0;
      margin-bottom: 4px;
    }

    .voice-actors-scroll {
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: thin;
      scrollbar-color: rgba(255, 255, 255, 0.2) transparent;

      &::-webkit-scrollbar {
        height: 4px;
      }

      &::-webkit-scrollbar-track {
        background: transparent;
      }

      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 2px;

        &:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      }
    }

    .voice-actors-container {
      display: flex;
      gap: 12px;
      min-width: max-content;

      .himself-item {
        display: flex;
        align-items: center;
        padding: 8px;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s ease;
        background-color: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.1);

        &:hover {
          background-color: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.2);
        }

        .himself-content {
          flex: 1;
          min-width: 0;

          .himself-text {
            font-size: 14px;
            font-weight: 600;
            color: #e0e0e0;
            line-height: 1.4;
          }
        }
      }
    }
  }
}

.voice-actor-item {
  width: 100%;
}

.status-icon {
  margin-right: 8px;
  opacity: 0.7;

  &.accepted {
    color: var(--ion-color-success);
  }

  &.waiting {
    color: var(--ion-color-warning);
  }
}
</style>
