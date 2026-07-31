<template>
  <div
    class="bg-[var(--app-overlay-2)] border border-[var(--app-overlay-10)] rounded-2xl p-4 shadow-sm w-full"
  >
    <div class="flex flex-col sm:grid sm:grid-cols-3 gap-4">
      <!-- Original Actor -->
      <div
        class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start relative"
      >
        <router-link
          :to="{ name: 'ActorDetails', params: { id: actor.id } }"
          class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] bg-[var(--app-overlay-5)] sm:mb-3 flex-shrink-0"
        >
          <img
            v-if="actor.profile_picture"
            :src="actor.profile_picture"
            class="w-full h-full object-cover"
            alt="Actor"
          />
        </router-link>
        <div class="flex flex-col min-w-0 flex-1">
          <div
            class="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1"
          >
            <FilmIcon class="w-3 h-3" />
            <span class="truncate">{{ t("details.actor", "Acteur") }}</span>
          </div>
          <router-link
            :to="{ name: 'ActorDetails', params: { id: actor.id } }"
            class="font-bold text-sm truncate"
            style="color: var(--app-color-text-primary);"
            :title="actor.name"
          >
            {{ actor.name || "Unknown" }}
          </router-link>
        </div>
      </div>

      <!-- Character -->
      <div
        class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start relative"
      >
        <div
          class="w-16 sm:w-full relative block overflow-hidden rounded-xl aspect-[2/3] bg-[var(--app-overlay-5)] sm:mb-3 flex-shrink-0"
        >
          <!-- Show first character image if exists -->
          <img
            v-if="actor.roles?.[0]?.image"
            :src="actor.roles[0].image"
            class="w-full h-full object-cover"
            alt="Character"
          />
        </div>
        <div class="flex flex-col min-w-0 flex-1">
          <div
            class="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1"
          >
            <UserIcon class="w-3 h-3" />
            <span class="truncate">{{
              t("details.character", "Personnage")
            }}</span>
          </div>
          <div
            class="font-bold text-sm truncate"
            style="color: var(--app-color-text-primary);"
            :title="actor.roles?.map((r) => r.character).join(', ') || ''"
          >
            {{
              actor.roles?.map((r) => r.character).join(", ") ||
              t("details.unknownCharacter", "Personnage inconnu")
            }}
          </div>
        </div>
      </div>

      <!-- Voice Actor -->
      <div
        class="flex flex-col min-w-0 gap-4 relative border-t border-[var(--app-overlay-10)] sm:border-t-0 pt-4 sm:pt-0 mt-2 sm:mt-0"
      >
        <template
          v-if="voiceActors && voiceActors.length && shouldShowVoiceActors"
        >
          <div
            v-for="voiceActor in voiceActors"
            :key="voiceActor.id"
            class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start w-full relative"
          >
            <router-link
              :to="{
                name: 'voice-actor-details',
                params: { id: voiceActor.id },
              }"
              @contextmenu.prevent="handleLongPress(voiceActor)"
              class="w-16 sm:w-full group relative block overflow-hidden rounded-xl aspect-[2/3] bg-[var(--app-overlay-5)] sm:mb-3 flex-shrink-0"
            >
              <img
                v-if="voiceActor.profile_picture"
                :src="voiceActor.profile_picture"
                class="w-full h-full object-cover"
                alt="Voice Actor"
              />
              <div
                v-else
                class="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-400"
              >
                {{ (voiceActor.firstname?.[0] || voiceActor.name?.[0] || '?') }}{{ (voiceActor.lastname?.[0] || voiceActor.name?.split(' ')?.[1]?.[0] || '') }}
              </div>

              <!-- Status Overlays -->
              <div class="absolute top-2 right-2 flex gap-1 z-10">
                <CheckCircle2
                  v-if="voiceActor.status === 'accepted'"
                  class="w-5 h-5 text-green-500 bg-white/80 dark:bg-black/80 rounded-full"
                />
                <Clock
                  v-if="!voiceActor.status || voiceActor.status === 'waiting'"
                  class="w-5 h-5 text-yellow-500 bg-white/80 dark:bg-black/80 rounded-full"
                />
              </div>
            </router-link>
            <div class="flex flex-col min-w-0 flex-1">
              <div
                class="flex items-center gap-1.5 text-[10px] text-gray-500 uppercase tracking-widest font-semibold mb-1"
              >
                <MicIcon class="w-3 h-3" />
                <span class="truncate">{{
                  t("details.voiceActor", "Voix VF")
                }}</span>
              </div>
              <router-link
                :to="{
                  name: 'voice-actor-details',
                  params: { id: voiceActor.id },
                }"
                class="font-bold text-sm truncate hover:underline"
                style="color: var(--app-color-text-primary);"
                :title="(voiceActor.firstname ? voiceActor.firstname + ' ' + voiceActor.lastname : voiceActor.name)"
              >
                {{ voiceActor.firstname ? voiceActor.firstname + ' ' + voiceActor.lastname : voiceActor.name }}
              </router-link>
              <div
                v-if="voiceActor.performance"
                class="text-xs text-gray-500 truncate mt-0.5"
                :title="voiceActor.performance"
              >
                {{ voiceActor.performance }}
              </div>
            </div>
          </div>
        </template>

        <template v-else-if="shouldShowVoiceActors">
          <div
            v-if="hasPermission('add_voice_actors')"
            @click="openVoiceActorSearch && openVoiceActorSearch(actor.id)"
            class="cursor-pointer flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start w-full relative group"
          >
            <div
              class="w-16 sm:w-full relative flex items-center justify-center rounded-xl aspect-[2/3] bg-[var(--app-overlay-2)] border border-dashed border-[var(--app-overlay-20)] sm:mb-3 group-hover:bg-[var(--app-overlay-5)] transition-colors flex-shrink-0"
            >
              <PlusCircle
                class="w-6 sm:w-8 h-6 sm:h-8 text-[var(--app-color-primary)]"
              />
            </div>
            <div class="flex flex-col min-w-0 flex-1">
              <div
                class="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1"
              >
                <MicIcon class="w-3 h-3 opacity-50" />
                <span class="truncate">{{
                  t("details.voiceActor", "Voix VF")
                }}</span>
              </div>
              <div class="text-sm text-gray-400 italic truncate">
                {{ t("details.notSpecified", "Non renseignée") }}
              </div>
            </div>
          </div>
          <div
            v-else
            class="flex flex-row sm:flex-col min-w-0 gap-4 sm:gap-0 items-center sm:items-start w-full relative"
          >
            <div
              class="w-16 sm:w-full relative flex items-center justify-center rounded-xl aspect-[2/3] bg-[var(--app-overlay-2)] border border-dashed border-[var(--app-overlay-10)] sm:mb-3 flex-shrink-0"
            >
              <span class="text-gray-400 text-xs text-center px-2">?</span>
            </div>
            <div class="flex flex-col min-w-0 flex-1">
              <div
                class="flex items-center gap-1.5 text-[10px] text-gray-400 uppercase tracking-widest font-semibold mb-1"
              >
                <MicIcon class="w-3 h-3 opacity-50" />
                <span class="truncate">{{
                  t("details.voiceActor", "Voix VF")
                }}</span>
              </div>
              <div class="text-sm text-gray-400 italic truncate">
                {{ t("details.notSpecified", "Non renseignée") }}
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Action Sheet -->
    <AppActionSheet
      v-model:is-open="isActionSheetOpen"
      :header="t('common.actions')"
      :buttons="actionSheetButtons"
    />
  </div>
</template>

<script setup lang="ts">
import AppButton from "@/components/common/AppButton.vue";
import PlusCircle from "~icons/lucide/plus-circle";
import CheckCircle2 from "~icons/lucide/check-circle-2";
import Clock from "~icons/lucide/clock";
import FilmIcon from "~icons/lucide/clapperboard";
import UserIcon from "~icons/lucide/user";
import MicIcon from "~icons/lucide/mic";
import PersonItem, { PersonData } from "./PersonItem.vue";
import { useLanguagePreference } from "@/composables/useLanguagePreference";
import { computed, ref, watch } from "vue";

import AppActionSheet, {
  ActionSheetButton,
} from "@/components/common/AppActionSheet.vue";
import { usePermissions } from "@/composables/usePermissions";
import { useVoiceActorManagement } from "@/composables/useVoiceActorManagement";
import { useAuthStore } from "@/stores/auth";
import ClockIcon from "~icons/lucide/clock";
import CheckCircle2Icon from "~icons/lucide/check-circle-2";
import XCircleIcon from "~icons/lucide/x-circle";
import ThumbsUpIcon from "~icons/lucide/thumbs-up";
import ThumbsDownIcon from "~icons/lucide/thumbs-down";
import Edit3Icon from "~icons/lucide/edit-3";
import Trash2Icon from "~icons/lucide/trash-2";
import { useI18n } from "vue-i18n";
import { Actor } from "@supabase/functions/_shared/types";
import type { VoiceActorInfo } from "@/types/models";

export interface ActorWithVoiceActorsProps {
  actor: PersonData;
  voiceActors?: Array<VoiceActorInfo>;
  onActorClick?: (actor: PersonData) => void;
  onVoiceActorClick?: (voiceActor: { id: number }) => void;
  mediaLanguage?: string;
  editVoiceActorLink?: (
    workItem: Pick<VoiceActorInfo, "work_id" | "performance">,
  ) => void;
  confirmDeleteVoiceActorLink?: (
    workItem: Pick<VoiceActorInfo, "work_id">,
  ) => void;
  addVoiceActorLink?: (actor: PersonData) => void;
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

function handleLongPress(voiceActor: { id: number }) {
  openActionSheet(voiceActor);
}

const isActionSheetOpen = ref(false);
const actionSheetButtons = ref<ActionSheetButton[]>([]);

// Open comprehensive action sheet
const openActionSheet = async (voiceActor: VoiceActorInfo) => {
  const buttons: ActionSheetButton[] = [];

  // A user is the owner if their linked voice_actor_id matches this voice actor's profile ID
  const isOwner =
    authStore.user?.user_metadata?.voice_actor_id === voiceActor.id;

  // Review status actions if admin or owner
  const canUpdateReviewStatus = authStore.isAdmin || isOwner;
  if (canUpdateReviewStatus && voiceActor.work_id !== undefined) {
    const workId = voiceActor.work_id;
    buttons.push(
      {
        text: `${t("common.setStatus")} - ${t("common.waiting")}`,
        icon: ClockIcon,
        handler: async () => {
          await updateReviewStatus(workId, "waiting");
          // Force a refresh of the component to show updated status
          location.reload();
        },
      },
      {
        text: `${t("common.setStatus")} - ${t("common.accepted")}`,
        icon: CheckCircle2Icon,
        handler: async () => {
          await updateReviewStatus(workId, "accepted");
          // Force a refresh of the component to show updated status
          location.reload();
        },
      },
      {
        text: `${t("common.setStatus")} - ${t("common.rejected")}`,
        icon: XCircleIcon,
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
          (voiceActor.work_id
            ? votes.value[voiceActor.work_id]?.up_count
            : 0) || 0
        })`,
        icon: ThumbsUpIcon,
        handler: () => {
          if (voiceActor.work_id) castVote(voiceActor.work_id, "up");
        },
      },
      {
        text: `${t("common.downvote")} (${
          (voiceActor.work_id
            ? votes.value[voiceActor.work_id]?.down_count
            : 0) || 0
        })`,
        icon: ThumbsDownIcon,
        handler: () => {
          if (voiceActor.work_id) castVote(voiceActor.work_id, "down");
        },
      },
    );
  }

  // Admin or Owner actions
  const canEdit =
    authStore.isAdmin || (hasPermission("edit_voice_actor_link") && isOwner);
  if (canEdit) {
    buttons.push({
      text: t("common.edit"),
      icon: Edit3Icon,
      handler: () => {
        props.editVoiceActorLink && props.editVoiceActorLink(voiceActor);
      },
    });
  }

  const canDelete =
    authStore.isAdmin || (hasPermission("delete_voice_actor_link") && isOwner);
  if (canDelete) {
    buttons.push({
      text: t("common.unlinkVoiceActor", "Délier ce comédien"),
      role: "destructive",
      icon: Trash2Icon,
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

  actionSheetButtons.value = buttons;
  isActionSheetOpen.value = true;
};
</script>

<style scoped lang="scss">
.actor-with-voice-actors {
  display: flex;
  flex-direction: column;
  padding: 12px;
  border-radius: 12px;
  background: var(--app-overlay-2);

  .character-name {
    font-size: 16px;
    font-weight: 600;
    color: var(--app-color-text-primary);
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
      color: var(--app-color-text-primary);
      margin-bottom: 4px;
    }

    .voice-actors-scroll {
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: thin;
      scrollbar-color: var(--app-overlay-20) transparent;

      &::-webkit-scrollbar {
        height: 4px;
      }

      &::-webkit-scrollbar-track {
        background: transparent;
      }

      &::-webkit-scrollbar-thumb {
        background: var(--app-overlay-20);
        border-radius: 2px;

        &:hover {
          background: var(--app-overlay-30);
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
        background-color: var(--app-overlay-2);
        border: 1px solid var(--app-overlay-10);

        &:hover {
          background-color: var(--app-overlay-5);
          border-color: var(--app-overlay-20);
        }

        .himself-content {
          flex: 1;
          min-width: 0;

          .himself-text {
            font-size: 14px;
            font-weight: 600;
            color: var(--app-color-text-primary);
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
    color: var(--app-color-success);
  }

  &.waiting {
    color: var(--app-color-warning);
  }
}
</style>
