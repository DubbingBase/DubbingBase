import { onUnmounted, ref, watch } from "vue";
import { useIonRouter } from "@ionic/vue";
import { alertController } from "@ionic/vue";
import { storeToRefs } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { supabase } from "@/api/supabase";

export interface VoiceActor {
  id: number;
  firstname: string;
  lastname: string;
  profile_picture?: string;
}

export interface WorkAndVoiceActor {
  id: number;
  voice_actor_id: number;
  work_id: number;
  work_type: string;
  performance: string;
  voiceActorDetails: VoiceActor;
}

export function useVoiceActorManagement(
  workType: "movie" | "tv" | "season" | "episode",
) {
  const ionRouter = useIonRouter();
  const authStore = useAuthStore();
  const { isAdmin } = storeToRefs(authStore);

  // Search modal state
  const showVoiceActorSearch = ref(false);
  const searchTerm = ref("");
  const searchResults = ref<VoiceActor[]>([]);
  const isSearching = ref(false);
  const searchError = ref("");
  const selectedActor = ref<number>();

  // Voice actors data
  const voiceActors = ref<WorkAndVoiceActor[]>([]);
  const isLoading = ref(false);
  const error = ref("");

  // Voting state
  const votes = ref<Record<number, { up_count: number; down_count: number; user_vote: string | null }>>({});
  const isVoting = ref(false);
  const votingError = ref("");

  // Search timer for debouncing
  let searchTimer: NodeJS.Timeout | null = null;

  const getVoiceActorByTmdbId = (tmdbId: number): WorkAndVoiceActor[] => {
    console.log("tmdbId", tmdbId);
    console.log("voiceActors.value", voiceActors.value);
    return voiceActors.value.filter((va) => va.voice_actor_id === tmdbId);
  };

  const openVoiceActorSearch = (actor: any) => {
    selectedActor.value = actor;
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
      const response = await supabase.functions.invoke("search-voice-actors", {
        body: {
          query: searchTerm.value,
        },
      });
      console.log(response.data);
      searchResults.value = response.data;
    } catch (err) {
      console.error("Error searching voice actors:", err);
      searchError.value = "Failed to search voice actors. Please try again.";
    } finally {
      isSearching.value = false;
    }
  };

  const linkVoiceActor = async (voiceActor: VoiceActor, contentId: string) => {
    console.log("selectedActor.value", selectedActor.value);
    try {
      const response = await supabase.functions.invoke("link-voice-actor", {
        body: {
          actor_id: selectedActor.value,
          media_type: workType,
          voice_actor_id: voiceActor.id,
          performance: "dialogues",
          media_id: contentId,
        },
      });

      // Add the new voice actor to the list
      voiceActors.value.push({
        ...response.data,
        voiceActorDetails: voiceActor,
      });

      // Close the modal
      showVoiceActorSearch.value = false;
    } catch (error) {
      console.error("Error linking voice actor:", error);
      const alert = await alertController.create({
        header: "Error",
        message: "Failed to link voice actor. Please try again.",
        buttons: ["OK"],
      });
      await alert.present();
    }
  };

  const editVoiceActorLink = async (workItem: WorkAndVoiceActor) => {
    const alert = await alertController.create({
      header: "Edit Performance",
      inputs: [
        {
          name: "performance",
          type: "text",
          placeholder: "Performance type (e.g., Voice, ADR, etc.)",
          value: workItem.performance || "Voice",
        },
      ],
      buttons: [
        {
          text: "Cancel",
          role: "cancel",
        },
        {
          text: "Save",
          handler: async (data) => {
            await updateVoiceActorLink(workItem.id, data.performance);
          },
        },
      ],
    });

    await alert.present();
  };

  const updateVoiceActorLink = async (workId: number, performance: string) => {
    try {
      const response = await supabase.functions.invoke(
        "update_voice_actor_link",
        {
          body: {
            work_id: workId,
            performance,
          },
        },
      );

      // Update the local state
      const index = voiceActors.value.findIndex((va) => va.id === workId);
      if (index !== -1) {
        voiceActors.value[index].performance = response.data.performance;
      }
    } catch (error) {
      console.error("Error updating voice actor link:", error);
      const alert = await alertController.create({
        header: "Error",
        message: "Failed to update voice actor link. Please try again.",
        buttons: ["OK"],
      });
      await alert.present();
    }
  };

  const confirmDeleteVoiceActorLink = async (workItem: WorkAndVoiceActor) => {
    console.log("workItem", workItem);
    const alert = await alertController.create({
      header: "Confirm Delete",
      message:
        `Are you sure you want to remove ${workItem.voiceActorDetails.firstname} ${workItem.voiceActorDetails.lastname}?`,
      buttons: [
        {
          text: "Cancel",
          role: "cancel",
        },
        {
          text: "Delete",
          role: "destructive",
          handler: () => deleteVoiceActorLink(workItem.id),
        },
      ],
    });
    await alert.present();
  };

  const deleteVoiceActorLink = async (workId: number) => {
    try {
      await supabase.functions.invoke("delete-voice-actor-link", {
        body: {
          work_id: workId,
        },
      });

      // Remove from local state
      voiceActors.value = voiceActors.value.filter((va) => va.id !== workId);
    } catch (error) {
      console.error("Error deleting voice actor link:", error);
      const alert = await alertController.create({
        header: "Error",
        message: "Failed to delete voice actor link. Please try again.",
        buttons: ["OK"],
      });
      await alert.present();
    }
  };

  const goToVoiceActor = (id: number) => {
    ionRouter.push({
      name: "VoiceActorDetails",
      params: { id },
    });
  };

  const goToActor = (id: number) => {
    ionRouter.push({
      name: "ActorDetails",
      params: { id },
    });
  };

  const updateReviewStatus = async (workId: number, status: 'waiting' | 'accepted' | 'rejected') => {
    if (!authStore.user) {
      console.error("User not authenticated");
      return;
    }

    try {
      const response = await supabase.functions.invoke("update-review-status", {
        body: {
          work_id: workId,
          reviewed_status: status,
        },
      });

      if (!response.data?.success) {
        throw new Error("Failed to update review status");
      }

      // Update local state - find the voice actor and update its reviewed_status
      // Note: voiceActors.value contains PersonData objects, not the raw work data
      // The UI will need to be refreshed to show the updated status
      console.log("Review status updated, UI should refresh to show changes");

      console.log("Review status updated successfully");
    } catch (error) {
      console.error("Error updating review status:", error);
      throw error;
    }
  };

  const castVote = async (workId: number, voteType: 'up' | 'down') => {
    if (!authStore.user) {
      votingError.value = "You must be logged in to vote.";
      return;
    }

    const previousVote = votes.value[workId]?.user_vote;
    const previousUpCount = votes.value[workId]?.up_count || 0;
    const previousDownCount = votes.value[workId]?.down_count || 0;

    // Optimistic update
    const newUserVote = previousVote === voteType ? null : voteType;
    const newUpCount = previousVote === 'up' && voteType === 'up' ? previousUpCount - 1 :
                      previousVote !== 'up' && voteType === 'up' ? previousUpCount + 1 : previousUpCount;
    const newDownCount = previousVote === 'down' && voteType === 'down' ? previousDownCount - 1 :
                        previousVote !== 'down' && voteType === 'down' ? previousDownCount + 1 : previousDownCount;

    votes.value[workId] = {
      up_count: newUpCount,
      down_count: newDownCount,
      user_vote: newUserVote,
    };

    isVoting.value = true;
    votingError.value = "";

    try {
      const response = await supabase.functions.invoke("cast-vote", {
        body: {
          work_id: workId,
          vote_type: voteType,
        },
      });

      if (!response.data?.success) {
        throw new Error("Failed to cast vote");
      }
    } catch (error) {
      console.error("Error casting vote:", error);
      votingError.value = "Failed to cast vote. Please try again.";

      // Revert optimistic update
      votes.value[workId] = {
        up_count: previousUpCount,
        down_count: previousDownCount,
        user_vote: previousVote,
      };
    } finally {
      isVoting.value = false;
    }
  };

  const refreshVotes = async (workIds: number[]) => {
    if (!authStore.user) {
      return;
    }

    try {
      const response = await supabase.functions.invoke("get-work-votes", {
        body: {
          work_ids: workIds,
        },
      });

      votes.value = { ...votes.value, ...response.data };
    } catch (error) {
      console.error("Error refreshing votes:", error);
      votingError.value = "Failed to refresh votes.";
    }
  };

  // Watch for search term changes and trigger search with debouncing
  watch(searchTerm, (newTerm) => {
    if (searchTimer) {
      clearTimeout(searchTimer);
    }
    searchTimer = setTimeout(() => {
      searchVoiceActors();
    }, 300); // 300ms debounce
  });

  // Cleanup timer on unmount
  onUnmounted(() => {
    if (searchTimer) {
      clearTimeout(searchTimer);
    }
  });

  watch(voiceActors, (newVal) => {
    console.log("voiceActors changed:", newVal);
  });

  return {
    // State
    showVoiceActorSearch,
    searchTerm,
    searchResults,
    isSearching,
    searchError,
    voiceActors,
    isLoading,
    error,
    isAdmin,
    votes,
    isVoting,
    votingError,

    // Methods
    getVoiceActorByTmdbId,
    openVoiceActorSearch,
    searchVoiceActors,
    linkVoiceActor,
    editVoiceActorLink,
    confirmDeleteVoiceActorLink,
    deleteVoiceActorLink,
    goToVoiceActor,
    goToActor,
    updateReviewStatus,
    castVote,
    refreshVotes,
  };
}
