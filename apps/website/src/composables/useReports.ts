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

      const { data, error: invokeError } = await supabase.functions.invoke(
        "submit-user-report",
        {
          body: { target_url: targetUrl, reason, details },
        },
      );

      if (invokeError) {
        throw invokeError;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

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
