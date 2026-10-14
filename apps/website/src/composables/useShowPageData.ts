import { computed, type Ref } from "vue";
import { useRouter, type NuxtApp } from "#app";
import { fetchShowData } from "@app/shared-logic";
import { getHydrationCachedData } from "./getHydrationCachedData";

async function fetchShowDataForCurrentRoute(nuxtApp: NuxtApp) {
  const { id, locale } = await nuxtApp.runWithContext(() => {
    const route = useRouter().currentRoute.value;
    const routeId = route.params.id;

    return {
      id: Array.isArray(routeId) ? (routeId[0] ?? "") : (routeId ?? ""),
      locale: nuxtApp.$i18n.locale.value,
    };
  });

  return fetchShowData(id, locale);
}

const SHOW_PAGE_DATA_OPTIONS = {
  lazy: true,
  getCachedData: getHydrationCachedData,
};

export function useShowPageData(
  showId: Readonly<Ref<string>>,
  locale: Readonly<Ref<string>>,
) {
  const key = computed(() => `show-${showId.value}-${locale.value}`);

  return useAsyncData(
    key,
    fetchShowDataForCurrentRoute,
    SHOW_PAGE_DATA_OPTIONS,
  );
}
