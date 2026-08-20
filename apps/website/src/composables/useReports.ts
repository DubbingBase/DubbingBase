import { ref } from "vue";

export const useReports = () => {
  const user = useSupabaseUser();
  const isSubmitting = ref(false);
  const error = ref<string | null>(null);

  const submitReport = async (
    targetUrl: string,
    reason: string,
    details: string,
  ) => {
    isSubmitting.value = true;
    error.value = null;

    try {
      if (!user.value) {
        throw new Error("You must be logged in to report content.");
      }

      const data = await $fetch<any>("/api/submit-user-report", {
        method: "POST",
        body: { target_url: targetUrl, reason, details },
      });

      if (data?.error) {
        throw new Error(data.error);
      }

      return true;
    } catch (err: any) {
      error.value =
        err.data?.message ||
        err.message ||
        "An error occurred while submitting the report.";
      console.error("Error submitting report:", err);
      return false;
    } finally {
      isSubmitting.value = false;
    }
  };

  return {
    submitReport,
    isSubmitting,
    error,
  };
};
