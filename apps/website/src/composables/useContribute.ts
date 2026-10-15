import { ref } from "vue";
import type { Database } from "@app/supabase";

export type ContributionCategory = "any" | "enrich_voice_actor" | "enrich_studio";

type VoiceActor = Database["public"]["Tables"]["voice_actors"]["Row"];
type Studio = Database["public"]["Tables"]["studios"]["Row"];
export type ClaimedCategory = Exclude<ContributionCategory, "any">;

// The contribution form uses one display shape for actors and studios.
export interface ContributionTask
  extends
    Partial<
      Pick<
        VoiceActor,
        | "firstname"
        | "lastname"
        | "profile_picture"
        | "nationality"
        | "date_of_birth"
        | "bio"
        | "tmdb_id"
        | "wikidata_id"
      >
    >,
    Partial<Pick<Studio, "name" | "logo_url" | "country" | "city" | "website_url">> {
  id: VoiceActor["id"] | Studio["id"];
  social_media_links?: Record<string, string | null> | null;
}

const supportedFields: Record<ClaimedCategory, readonly string[]> = {
  enrich_voice_actor: [
    "file",
    "nationality",
    "date_of_birth",
    "bio",
    "tmdb_id",
    "wikidata_id",
    "twitter",
    "instagram",
    "tiktok",
    "facebook",
  ],
  enrich_studio: [
    "file",
    "country",
    "city",
    "website_url",
    "twitter",
    "instagram",
    "tiktok",
    "facebook",
  ],
};

export type ContributionClaim =
  | {
      task: ContributionTask;
      category: ClaimedCategory;
      claimId: string;
      expiresAt: string;
    }
  | {
      task: null;
      category: ClaimedCategory;
      claimId: null;
      expiresAt: null;
    };

interface ContributionSuccess {
  success: true;
  pointsAwarded: number;
}

export const fetchRandomTask = (category: ContributionCategory): Promise<ContributionClaim> =>
  $fetch<ContributionClaim>("/api/get-random-task", {
    method: "POST",
    body: { category },
    // Retrying a claim can create another reservation after a lost response.
    retry: 0,
  });

const errorStatus = (error: unknown): number | undefined => {
  if (typeof error !== "object" || error === null) return;
  if ("statusCode" in error && typeof error.statusCode === "number") return error.statusCode;
  if ("status" in error && typeof error.status === "number") return error.status;
};

export const useContribute = () => {
  const { t } = useI18n();
  const isLoading = ref(false);
  const isSubmitting = ref(false);
  const error = ref<string | null>(null);
  const currentTask = ref<ContributionTask | null>(null);
  const activeCategory = ref<ContributionCategory | null>(null);
  const claimId = ref<string | null>(null);
  const expiresAt = ref<string | null>(null);
  const noTask = ref(false);
  const requiresLogin = ref(false);
  let requestId = 0;

  const clearClaim = (): void => {
    currentTask.value = null;
    claimId.value = null;
    expiresAt.value = null;
  };

  const reset = (): void => {
    requestId++;
    clearClaim();
    activeCategory.value = null;
    error.value = null;
    noTask.value = false;
    requiresLogin.value = false;
    isLoading.value = false;
    isSubmitting.value = false;
  };

  const handleError = (cause: unknown, action: "load" | "submit"): void => {
    const status = errorStatus(cause);
    requiresLogin.value = status === 401;
    if (status === 401) {
      clearClaim();
      error.value = "Please sign in to contribute.";
    } else if (status === 403 || status === 409 || status === 410 || status === 423) {
      clearClaim();
      error.value = "This task is no longer available. Please load another task.";
    } else if (status === 400) {
      error.value =
        action === "load"
          ? "This contribution category is not supported."
          : "Please check your contribution and try again.";
    } else if (action === "submit" && status === 413) {
      error.value = t("contribute.uploadTooLarge");
    } else if (action === "submit" && status === 415) {
      error.value = t("contribute.unsupportedUploadFormat");
    } else {
      error.value =
        action === "load"
          ? "Unable to load a task. Please try again."
          : "Unable to submit your contribution. Your input has been kept; please try again.";
    }
  };

  const getRandomTask = async (category: ContributionCategory): Promise<void> => {
    if (isSubmitting.value) return;
    reset();
    const request = requestId;
    activeCategory.value = category;
    isLoading.value = true;
    try {
      const data = await fetchRandomTask(category);
      if (request !== requestId) return;
      if (
        (data.category !== "enrich_voice_actor" && data.category !== "enrich_studio") ||
        (data.task !== null && (!data.claimId || !data.expiresAt)) ||
        (data.task === null && (data.claimId !== null || data.expiresAt !== null))
      )
        throw new Error("Invalid claim response");
      currentTask.value = data.task;
      activeCategory.value = data.category;
      claimId.value = data.claimId;
      expiresAt.value = data.expiresAt;
      noTask.value = data.task === null;
    } catch (cause: unknown) {
      if (request === requestId) handleError(cause, "load");
    } finally {
      if (request === requestId) isLoading.value = false;
    }
  };

  const submitTask = async (
    fields: Record<string, string | File | undefined>,
  ): Promise<ContributionSuccess | null> => {
    if (isSubmitting.value || isLoading.value || !currentTask.value || !claimId.value) return null;
    if (
      !expiresAt.value ||
      !Number.isFinite(Date.parse(expiresAt.value)) ||
      Date.parse(expiresAt.value) <= Date.now()
    ) {
      clearClaim();
      error.value = "This task has expired. Please load another task.";
      return null;
    }
    const request = requestId;
    isSubmitting.value = true;
    error.value = null;
    try {
      const formData = new FormData();
      formData.append("claimId", claimId.value);
      if (!activeCategory.value || activeCategory.value === "any") return null;
      for (const key of supportedFields[activeCategory.value]) {
        const value = fields[key];
        if (value !== undefined && value !== "") formData.append(key, value);
      }
      const data = await $fetch<ContributionSuccess>("/api/submit-task", {
        method: "POST",
        body: formData,
        retry: 0,
      });
      if (request !== requestId) return null;
      if (data.success !== true || !Number.isFinite(data.pointsAwarded)) {
        throw new Error("Invalid submission response");
      }
      clearClaim();
      return data;
    } catch (cause: unknown) {
      if (request === requestId) handleError(cause, "submit");
      return null;
    } finally {
      if (request === requestId) isSubmitting.value = false;
    }
  };

  return {
    getRandomTask,
    submitTask,
    reset,
    currentTask,
    activeCategory,
    claimId,
    expiresAt,
    noTask,
    requiresLogin,
    isLoading,
    isSubmitting,
    error,
  };
};
