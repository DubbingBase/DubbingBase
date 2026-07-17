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
            <PlusCircle class="app-icon" />
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
                @contextmenu.prevent="handleLongPress(voiceActor)"
                class="voice-actor-item"
                :person="voiceActor"
                type="voice-actor"
              >
                <template #actions>
                  <!-- Status Indicators -->
                  <CheckCircle2 v-if="(voiceActor as any).status === 'accepted'" class="app-icon status-icon accepted" />
                  <Clock v-if="!(voiceActor as any).status || (voiceActor as any).status === 'waiting'" class="app-icon status-icon waiting" />
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
import PlusCircle from '~icons/lucide/plus-circle';
import CheckCircle2 from '~icons/lucide/check-circle-2';
import Clock from '~icons/lucide/clock';
import PersonItem, { PersonData } from "./PersonItem.vue";

import { useLanguagePreference } from "@/composables/useLanguagePreference";
import { computed, watch } from "vue";

import { IonButton, actionSheetController } from "@ionic/vue";
import { timeOutline, checkmarkCircleOutline, closeCircleOutline, thumbsUpOutline, thumbsDownOutline, createOutline, trashOutline } from "ionicons/icons";
import { usePermissions } from "@/composables/usePermissions";
import { useVoiceActorManagement } from "@/composables/useVoiceActorManagement";
import { useAuthStore } from "@/stores/auth";
import { useI18n } from "vue-i18n";
import {
  Actor,
  VoiceActorDetails,
} from "@supabase/functions/_shared/types";

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

// Watch for voice actors changes by watching a serialized string of their IDs.
// This prevents redundant/infinite API calls when the parent passes a new array reference on render.
watch(
  () => props.voiceActors?.map((va) => va.id).join(","),
  (newVal, oldVal) => {
    if (
      props.voiceActors &&
      props.voiceActors.length > 0 &&
      newVal !== oldVal &&
      authStore.isAuthenticated
    ) {
      // Only request votes for work entries that are not already loaded in the shared votes state
      const missingWorkIds = props.voiceActors
        .map((va) => va.work_id)
        .filter((id): id is number => id !== undefined && !votes.value[id]);

      if (missingWorkIds.length > 0) {
        refreshVotes(missingWorkIds);
      }
    }
  },
  { immediate: true },
);

console.log(
  "[ActorWithVoiceActors] canAccess add_voice_actors:",
  hasPermission("add_voice_actors"),
);

const shouldShowVoiceActors = computed(() => {
  return (
    props.mediaLanguage.toLowerCase() !== preferredLanguage.value.toLowerCase()
  );
});

function handleLongPress(voiceActor: PersonData<VoiceActorDetails>) {
  openActionSheet(voiceActor);
}

// Open comprehensive action sheet
const openActionSheet = async (voiceActor: PersonData<VoiceActorDetails>) => {
  const buttons: any[] = [];

  // A user is the owner if their linked voice_actor_id matches this voice actor's profile ID
  const isOwner = authStore.user?.user_metadata?.voice_actor_id === voiceActor.id;

  // Review status actions if admin or owner
  const canUpdateReviewStatus = authStore.isAdmin || isOwner;
  if (canUpdateReviewStatus && voiceActor.work_id !== undefined) {
    const workId = voiceActor.work_id;
    buttons.push(
      {
        text: `${t("common.setStatus")} - ${t("common.waiting")}`,
        icon: timeOutline,
        handler: async () => {
          await updateReviewStatus(workId, "waiting");
          // Force a refresh of the component to show updated status
          location.reload();
        },
      },
      {
        text: `${t("common.setStatus")} - ${t("common.accepted")}`,
        icon: checkmarkCircleOutline,
        handler: async () => {
          await updateReviewStatus(workId, "accepted");
          // Force a refresh of the component to show updated status
          location.reload();
        },
      },
      {
        text: `${t("common.setStatus")} - ${t("common.rejected")}`,
        icon: closeCircleOutline,
        handler: async () => {
          await updateReviewStatus(workId, "rejected");
          // Force a refresh of the component to show updated status
          location.reload();
        },
      },
    );
  }

  // Vote actions if authenticated
  if (authStore.isAuthenticated) {
    buttons.push(
      {
        text: `${t("common.upvote")} (${
          (voiceActor.work_id ? votes.value[voiceActor.work_id]?.up_count : 0) || 0
        })`,
        icon: thumbsUpOutline,
        handler: () => {
          if (voiceActor.work_id) castVote(voiceActor.work_id, "up");
        },
      },
      {
        text: `${t("common.downvote")} (${
          (voiceActor.work_id ? votes.value[voiceActor.work_id]?.down_count : 0) || 0
        })`,
        icon: thumbsDownOutline,
        handler: () => {
          if (voiceActor.work_id) castVote(voiceActor.work_id, "down");
        },
      },
    );
  }

  // Admin or Owner actions
  const canEdit = authStore.isAdmin || (hasPermission("edit_voice_actor_link") && isOwner);
  if (canEdit) {
    buttons.push({
      text: t("common.edit"),
      icon: createOutline,
      handler: () => {
        props.editVoiceActorLink &&
          props.editVoiceActorLink(voiceActor);
      },
    });
  }

  const canDelete = authStore.isAdmin || (hasPermission("delete_voice_actor_link") && isOwner);
  if (canDelete) {
    buttons.push({
      text: t("common.unlinkVoiceActor", "Délier ce comédien"),
      icon: trashOutline,
      role: "destructive",
      handler: () => {
        props.confirmDeleteVoiceActorLink &&
          props.confirmDeleteVoiceActorLink(voiceActor);
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
