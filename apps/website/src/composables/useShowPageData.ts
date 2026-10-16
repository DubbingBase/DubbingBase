import { computed, type Ref } from "vue";
import { useRouter, type NuxtApp } from "#app";
import { fetchShowData } from "@app/shared-logic";
import { getHydrationCachedData } from "./getHydrationCachedData";

type ShowPageDataResult = {
  requestKey: string;
  response: Awaited<ReturnType<typeof fetchShowData>>;
};

async function fetchShowDataForCurrentRoute(nuxtApp: NuxtApp) {
  const request = await nuxtApp.runWithContext(() => {
    const route = useRouter().currentRoute.value;
    const routeId = route.params.id;
    const id = Array.isArray(routeId) ? (routeId[0] ?? "") : (routeId ?? "");
    const locale = nuxtApp.$i18n.locale.value;

    return {
      id,
      locale,
      requestKey: `show-${id}-${locale}`,
    };
  });

  return {
    requestKey: request.requestKey,
    response: await fetchShowData(request.id, request.locale, {
      projection: "media-page",
    }),
  } satisfies ShowPageDataResult;
}

const SHOW_PAGE_DATA_OPTIONS = {
  lazy: true,
  getCachedData: getHydrationCachedData,
};

export function useShowPageData(showId: Readonly<Ref<string>>, locale: Readonly<Ref<string>>) {
  const key = computed(() => `show-${showId.value}-${locale.value}`);

  const asyncData = useAsyncData(key, fetchShowDataForCurrentRoute, SHOW_PAGE_DATA_OPTIONS);

  const currentData = computed(() => {
    const result = asyncData.data.value;
    return result?.requestKey === key.value ? result.response : undefined;
  });

  return Object.assign(asyncData, { currentData });
}
