import { ref } from "vue";

export const useContribute = () => {
  const supabase = useSupabaseClient();
  const isLoading = ref(false);
  const isSubmitting = ref(false);
  const error = ref<string | null>(null);
  const currentTask = ref<any>(null);

  const getRandomTask = async (category: string) => {
    isLoading.value = true;
    error.value = null;
    currentTask.value = null;

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "get-random-task",
        {
          body: { category },
        },
      );

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      if (data?.task) {
        currentTask.value = data.task;
      } else if (data?.message) {
        // e.g. "No tasks available" or "Locked"
        error.value = data.message;
      }
    } catch (err: any) {
      error.value = err.message || "Failed to fetch a task.";
      console.error(err);
    } finally {
      isLoading.value = false;
    }
  };

  const submitTask = async (
    category: string,
    entityId: string,
    file?: File,
  ) => {
    isSubmitting.value = true;
    error.value = null;

    try {
      const formData = new FormData();
      formData.append("category", category);
      formData.append("entityId", entityId);
      if (file) {
        formData.append("file", file);
      }

      // We cannot use standard supabase.functions.invoke easily with FormData in older clients,
      // but if the client supports it, we can pass it directly, or use fetch.
      // Supabase client invoke supports FormData.

      const { data, error: invokeError } = await supabase.functions.invoke(
        "submit-task",
        {
          body: formData,
        },
      );

      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);

      return data; // contains { success: true, pointsAwarded: X }
    } catch (err: any) {
      error.value = err.message || "Failed to submit task.";
      console.error(err);
      return null;
    } finally {
      isSubmitting.value = false;
    }
  };

  return {
    getRandomTask,
    submitTask,
    currentTask,
    isLoading,
    isSubmitting,
    error,
  };
};
