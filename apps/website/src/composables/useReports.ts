import { ref } from "vue";

export const useReports = () => {
  const supabase = useSupabaseClient();
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
      const user = await supabase.auth.getUser();
      if (!user.data.user) {
        throw new Error("You must be logged in to report content.");
      }

      await $fetch('/api/submit-user-report', {
        method: 'POST',
        body: { target_url: targetUrl, reason, details },
      });

      return true;
    } catch (err: any) {
      error.value =
        err.message || "An error occurred while submitting the report.";
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
