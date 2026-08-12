import { alertController } from "@/composables/useAlert";
import { onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { useProfileStore } from "@/stores/profile";
import { supabase } from "@/api/supabase";
import { useI18n } from "vue-i18n";
import type { PersonData } from "@/components/PersonItem.vue";
import { voiceActorToPersonData } from "@/utils/convert";
import type {
  VoiceActorSummary,
  WorkPerformance,
  DubbingProject,
} from "@supabase/functions/_shared/types";

// Shared voting state across the app to prevent duplicate/redundant fetches for the same work entries
const votes = ref<
  Record<
    number,
    { up_count: number; down_count: number; user_vote: string | null }
  >
>({});

export function useVoiceActorManagement(
  getContentId: () => string,
  contentType: "movie" | "tv" | "video_game",
  onRefresh: () => Promise<void>,
) {
  const router = useRouter();
  const authStore = useAuthStore();
  const profileStore = useProfileStore();
  const { isAdmin } = storeToRefs(authStore);
  const { t } = useI18n();

  // Search modal state
  const showVoiceActorSearch = ref(false);
  const searchTerm = ref("");
  const searchResults = ref<VoiceActorSummary[]>([]);
  const isSearching = ref(false);
  const searchError = ref("");
  const selectedActor = ref<number>();

  // Voice actors data
  const voiceActors = ref<VoiceActorSummary[]>([]);
  const isLoading = ref(false);
  const error = ref("");

  // Voting state
  const isVoting = ref(false);
  const votingError = ref("");

  const getVoiceActorByTmdbId = (tmdbId: number): VoiceActorSummary[] => {
    return voiceActors.value.filter((va) => va.tmdb_id === tmdbId);
  };

  const openVoiceActorSearch = (actorId: number) => {
    selectedActor.value = actorId;
    searchTerm.value = "";
    searchResults.value = [];
    showVoiceActorSearch.value = true;
  };

  const searchVoiceActors = async () => {
    console.log("searchTerm.value", searchTerm.value);
    if (!searchTerm.value.trim()) {
      searchResults.value = [];
      return;
    }

    isSearching.value = true;
    searchError.value = "";

    try {
      const { data, error: fetchError } = await supabase.functions.invoke(
        "search-voice-actors",
        {
          body: { query: searchTerm.value.trim(), limit: 20 },
        },
      );

      if (fetchError) throw fetchError;

      searchResults.value = data || [];
    } catch (err) {
      console.error("Error searching voice actors:", err);
      searchError.value = "Failed to search voice actors";
    } finally {
      isSearching.value = false;
    }
  };

  const linkVoiceActor = async (voiceActorId: number, actorId: number) => {
    if (!selectedActor.value) return;

    try {
      const contentId = Number(getContentId());
      const { data, error: linkError } = await supabase.functions.invoke(
        "link-voice-actor",
        {
          body: {
            voice_actor_id: voiceActorId,
            actor_id: actorId,
            content_id: contentId,
            content_type: contentType,
            targetUserId: profileStore.impersonatedTargetUserId,
          },
        },
      );

      if (linkError) throw linkError;

      // Refresh voice actors list
      await onRefresh();

      showVoiceActorSearch.value = false;
      searchTerm.value = "";
      searchResults.value = [];
    } catch (err) {
      console.error("Error linking voice actor:", err);
    }
  };

  const editVoiceActorLink = async (work: WorkPerformance) => {
    if (!work.voice_actor) return;

    const contentId = Number(getContentId());
    router.push({
      name: "AddVoiceCast",
      params: {
        id: contentId,
        actorId: work.actor_id,
        workId: work.id,
      },
    });
  };

  const confirmDeleteVoiceActorLink = async (work: WorkPerformance) => {
    if (!work.voice_actor) return;

    const alert = await alertController.create({
      header: "Confirm Delete",
      message: `Are you sure you want to remove ${work.voice_actor.firstname} ${work.voice_actor.lastname} as the voice for ${work.suggestions || "this character"}?`,
      buttons: [
        {
          text: "Cancel",
          role: "cancel",
        },
        {
          text: "Delete",
          role: "destructive",
          handler: () => deleteVoiceActorLink(work.id),
        },
      ],
    });
    await alert.present();
  };

  const deleteVoiceActorLink = async (workId: number) => {
    try {
      const { error: deleteError } = await supabase.functions.invoke(
        "delete-voice-actor-link",
        {
          body: {
            id: workId,
            targetUserId: profileStore.impersonatedTargetUserId,
          },
        },
      );

      if (deleteError) throw deleteError;

      // Refresh the data
      await onRefresh();

      const toast = await alertController.create({
        message: "Voice actor link removed",
        duration: 2000,
        color: "success",
        position: "top",
      });
      await toast.present();
    } catch (err) {
      console.error("Error deleting voice actor link:", err);
      const toast = await alertController.create({
        message: "Failed to remove voice actor link",
        duration: 2000,
        color: "danger",
        position: "top",
      });
      await toast.present();
    }
  };

  const goToActor = (id: number) => {
    router.push({
      name: "ActorDetails",
      params: { id },
    });
  };

  const goToVoiceActor = (id: number) => {
    router.push({
      name: "VoiceActorDetails",
      params: { id },
    });
  };

  const castVote = async (workId: number, voteType: "up" | "down") => {
    if (isVoting.value) return;

    isVoting.value = true;
    votingError.value = "";

    try {
      const { error: voteError } = await supabase.functions.invoke(
        "cast-vote",
        {
          body: {
            work_id: workId,
            vote_type: voteType,
          },
        },
      );

      if (voteError) throw voteError;

      // Update local votes cache
      const currentVote = votes.value[workId] || {
        up_count: 0,
        down_count: 0,
        user_vote: null,
      };
      if (voteType === "up") {
        currentVote.up_count += currentVote.user_vote === "up" ? 0 : 1;
        currentVote.down_count -= currentVote.user_vote === "down" ? 1 : 0;
        currentVote.user_vote = "up";
      } else {
        currentVote.down_count += currentVote.user_vote === "down" ? 0 : 1;
        currentVote.up_count -= currentVote.user_vote === "up" ? 1 : 0;
        currentVote.user_vote = "down";
      }
      votes.value = { ...votes.value, [workId]: currentVote };
    } catch (err) {
      console.error("Error casting vote:", err);
      votingError.value = "Failed to cast vote";
    } finally {
      isVoting.value = false;
    }
  };

  const refreshVotes = async (workIds: number[]) => {
    try {
      const { data, error: fetchError } = await supabase.functions.invoke(
        "get-work-votes",
        {
          body: { work_ids: workIds },
        },
      );

      if (fetchError) throw fetchError;

      if (data) {
        votes.value = { ...votes.value, ...data };
      }
    } catch (err) {
      console.error("Error refreshing votes:", err);
    }
  };

  return {
    // State
    showVoiceActorSearch,
    voiceActors,
    isLoading,
    error,
    isSearching,
    searchResults,
    searchError,
    isVoting,
    votingError,
    votes,

    // Methods
    getVoiceActorByTmdbId,
    openVoiceActorSearch,
    searchVoiceActors,
    linkVoiceActor,
    editVoiceActorLink,
    confirmDeleteVoiceActorLink,
    deleteVoiceActorLink,
    goToActor,
    goToVoiceActor,
    castVote,
    refreshVotes,
  };
}
