import { computed, type Ref } from "vue";
import { useRouter, type NuxtApp } from "#app";
import { fetchShowData } from "@app/shared-logic";
import { getHydrationCachedData } from "./getHydrationCachedData";

async function fetchShowDataForCurrentRoute(nuxtApp: NuxtApp) {
  const { id, locale } = await nuxtApp.runWithContext(() => {
    const route = useRouter().currentRoute.value;
    const routeId = route.params.id;
    const { locale } = useI18n();

    return {
      id: Array.isArray(routeId) ? (routeId[0] ?? "") : (routeId ?? ""),
      locale: locale.value,
    };
  });

  return fetchShowData(id, locale);
}

export function useShowPageData(
  showId: Readonly<Ref<string>>,
  locale: Readonly<Ref<string>>,
) {
  const key = computed(() => `show-${showId.value}-${locale.value}`);

  return useAsyncData(key, fetchShowDataForCurrentRoute, {
    lazy: true,
    getCachedData: getHydrationCachedData,
  });
}
