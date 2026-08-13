import { ref } from "vue";

export const fetchRandomTask = async (supabase: any, category: string) => {
  const { data, error: invokeError } = await supabase.functions.invoke(
    "get-random-task",
    {
      body: { category },
    },
  );

  if (invokeError) throw invokeError;
  if (data?.error) throw new Error(data.error);

  return data;
};

export const useContribute = (
  initialTask?: any,
  initialCategory?: string | null,
) => {
  const supabase = useSupabaseClient();
  const isLoading = ref(false);
  const isSubmitting = ref(false);
  const error = ref<string | null>(null);
  const currentTask = ref<any>(initialTask || null);

  const activeCategory = ref<string | null>(initialCategory || null);

  const getRandomTask = async (category: string) => {
    isLoading.value = true;
    error.value = null;
    currentTask.value = null;
    activeCategory.value = null;

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
        activeCategory.value = data.category || category;
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
    fields: Record<string, string | File | undefined>,
  ) => {
    isSubmitting.value = true;
    error.value = null;

    try {
      const formData = new FormData();
      formData.append("category", category);
      formData.append("entityId", entityId);

      for (const [key, value] of Object.entries(fields)) {
        if (value) {
          formData.append(key, value);
        }
      }

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
    activeCategory,
    isLoading,
    isSubmitting,
    error,
  };
};
