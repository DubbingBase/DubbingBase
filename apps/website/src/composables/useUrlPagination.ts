import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

export function readUrlPage(value: unknown): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function useUrlPagination(queryKey: string) {
  const route = useRoute();
  const router = useRouter();

  const page = computed(() => readUrlPage(route.query[queryKey]));

  const setPage = async (nextPage: number): Promise<void> => {
    const query = { ...route.query };
    if (nextPage <= 1) {
      delete query[queryKey];
    } else {
      query[queryKey] = String(Math.floor(nextPage));
    }

    await router.replace({ query });
  };

  return { page, setPage };
}
