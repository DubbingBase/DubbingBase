import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, type Ref } from "vue";
import { APP_LOCALES } from "@app/shared-logic";

export type CharacterImageSource = "tvdb" | "wikimedia" | "dubbingbase";

export type CharacterImage = {
  src: string;
  source: CharacterImageSource;
  attribution?: string;
  sourceUrl?: string;
};

/** One card: the production it belongs to and the role names to look for. */
export type CharacterImageRequest = {
  mediaType: "movie" | "tv";
  mediaId: number | string;
  names: readonly (string | null | undefined)[];
};

type CharacterImagesResponse = {
  images: Record<string, CharacterImage | null>;
  characterIds: Record<string, string>;
  tvdbIds: Record<string, number>;
};

const MAX_BATCH = 24;
const MAX_CONCURRENT_REQUESTS = 4;
const NAME_SEPARATOR = "|";

/** Wire format and map key of one card; null when there is no usable role name. */
export function characterImageKey(request: CharacterImageRequest): string | null {
  const names = request.names
    .map((name) => name?.replaceAll(NAME_SEPARATOR, " ").trim())
    .filter((name): name is string => Boolean(name));
  return names.length > 0 && String(request.mediaId) !== ""
    ? `${request.mediaType}:${request.mediaId}:${names.join(NAME_SEPARATOR)}`
    : null;
}

/**
 * The one way pages get production-scoped character images (TVDB → Wikimedia
 * Commons → DubbingBase → placeholder): lazily, after hydration, only for the
 * cards currently shown, through /api/character-images. Never blocks SSR. A
 * failed image is re-requested with its source skipped so the server continues
 * down the chain.
 */
export function useCharacterImages(requests: Ref<readonly CharacterImageRequest[]>) {
  const { locale } = useI18n();
  const language = computed(
    () => APP_LOCALES.find((item) => item.code === locale.value)?.language ?? "en-US",
  );
  const images = reactive<Record<string, CharacterImage | null>>({});
  const tvdbIds = ref<Record<string, number>>({});
  const characterIds = reactive<Record<string, string>>({});
  const requested = new Set<string>();
  const skipped = new Map<string, CharacterImageSource[]>();
  // Latest request per card wins, so a slow stale response cannot restore a failed image.
  const generations = new Map<string, number>();
  const pendingLoads: Array<{
    keys: string[];
    skip: CharacterImageSource[];
    language: string;
    localeGeneration: number;
  }> = [];
  const activeLoads = new Set<AbortController>();
  let localeGeneration = 0;
  let mounted = false;
  let active = true;

  async function load(
    keys: string[],
    skip: CharacterImageSource[],
    requestLanguage: string,
    startedLocale: number,
    signal: AbortSignal,
  ): Promise<void> {
    if (keys.length === 0) return;
    // A stable order keeps the URL, and so the edge cache key, identical for the same cards.
    keys = [...keys].sort();
    skip = [...skip].sort();
    const started = new Map(keys.map((key) => [key, (generations.get(key) ?? 0) + 1]));
    for (const [key, generation] of started) generations.set(key, generation);
    // Paging away does not invalidate a completed production/role lookup in this locale.
    const isCurrent = (key: string) =>
      active && localeGeneration === startedLocale && generations.get(key) === started.get(key);
    try {
      const response = await $fetch<CharacterImagesResponse>("/api/character-images", {
        query: {
          item: keys,
          lang: requestLanguage,
          ...(skip.length > 0 ? { skip: skip.join(",") } : {}),
        },
        signal,
      });
      const responseKeys = keys.filter(isCurrent);
      const currentProductions = new Set(responseKeys.map((key) => key.split(":", 2).join(":")));
      tvdbIds.value = {
        ...tvdbIds.value,
        ...Object.fromEntries(
          Object.entries(response.tvdbIds).filter(([production]) =>
            currentProductions.has(production),
          ),
        ),
      };
      for (const key of responseKeys) {
        const characterId = response.characterIds[key];
        if (characterId !== undefined) characterIds[key] = characterId;
      }
      for (const key of responseKeys) images[key] = response.images[key] ?? null;
    } catch {
      // Provider or network failure: keep the placeholder; the card is requested again
      // the next time it is shown (page change or filter).
      for (const key of keys) {
        if (!isCurrent(key)) continue;
        images[key] = null;
        requested.delete(key);
      }
    }
  }

  function drainLoads(): void {
    while (activeLoads.size < MAX_CONCURRENT_REQUESTS && pendingLoads.length > 0) {
      const pending = pendingLoads.shift();
      if (!pending) break;
      const activeKeys = new Set(currentKeys());
      const keys = pending.keys.filter((key) => activeKeys.has(key) && requested.has(key));
      for (const key of pending.keys) if (!keys.includes(key)) requested.delete(key);
      if (keys.length === 0 || pending.localeGeneration !== localeGeneration) continue;
      const controller = new AbortController();
      activeLoads.add(controller);
      void load(
        keys,
        pending.skip,
        pending.language,
        pending.localeGeneration,
        controller.signal,
      ).finally(() => {
        activeLoads.delete(controller);
        drainLoads();
      });
    }
  }

  function enqueueLoad(keys: string[], skip: CharacterImageSource[] = []): void {
    pendingLoads.push({
      keys,
      skip: [...new Set(skip)],
      language: language.value,
      localeGeneration,
    });
    drainLoads();
  }

  function discardInactiveLoads(): void {
    const activeKeys = new Set(currentKeys());
    for (let index = pendingLoads.length - 1; index >= 0; index -= 1) {
      const pending = pendingLoads[index];
      if (!pending) continue;
      const keys = pending.keys.filter((key) => activeKeys.has(key));
      for (const key of pending.keys) if (!keys.includes(key)) requested.delete(key);
      if (keys.length === 0) pendingLoads.splice(index, 1);
      else pending.keys = keys;
    }
  }

  function currentKeys(): string[] {
    return [
      ...new Set(
        requests.value.map(characterImageKey).filter((key): key is string => key !== null),
      ),
    ];
  }

  function loadVisible(): void {
    if (!mounted) return;
    const keys = currentKeys().filter((key) => !requested.has(key));
    for (const key of keys) requested.add(key);
    // One request per production and fallback history keeps cache keys stable
    // without skipping a source for a healthy neighboring character.
    const groups = new Map<string, { keys: string[]; skip: CharacterImageSource[] }>();
    for (const key of keys) {
      const production = key.split(":", 2).join(":");
      const skip = [...new Set(skipped.get(key) ?? [])].sort();
      const groupKey = `${production}|${skip.join(",")}`;
      const group = groups.get(groupKey) ?? { keys: [], skip };
      group.keys.push(key);
      groups.set(groupKey, group);
    }
    for (const group of groups.values()) {
      for (let index = 0; index < group.keys.length; index += MAX_BATCH) {
        const batch = group.keys.slice(index, index + MAX_BATCH);
        enqueueLoad(batch, group.skip);
      }
    }
  }

  function reportImageError(request: CharacterImageRequest): void {
    const key = characterImageKey(request);
    const failed = key ? images[key] : null;
    if (!key || !failed) return;
    const skip = [...new Set([...(skipped.get(key) ?? []), failed.source])];
    skipped.set(key, skip);
    images[key] = null;
    enqueueLoad([key], skip);
  }

  /** The loaded image for a card, or null while loading / when none exists. */
  function imageFor(request: CharacterImageRequest): CharacterImage | null {
    const key = characterImageKey(request);
    return key ? (images[key] ?? null) : null;
  }

  /** TVDB role id of the uniquely matched character, even when it has no image. */
  function characterIdFor(request: CharacterImageRequest): string | undefined {
    const key = characterImageKey(request);
    return key ? characterIds[key] : undefined;
  }

  onMounted(() => {
    mounted = true;
    loadVisible();
  });
  watch(
    () => currentKeys().join("\n"),
    () => {
      discardInactiveLoads();
      loadVisible();
    },
  );
  watch(locale, () => {
    localeGeneration += 1;
    pendingLoads.length = 0;
    for (const controller of activeLoads.keys()) controller.abort();
    requested.clear();
    skipped.clear();
    for (const key of Object.keys(images)) delete images[key];
    for (const key of Object.keys(characterIds)) delete characterIds[key];
    tvdbIds.value = {};
    loadVisible();
  });
  onBeforeUnmount(() => {
    active = false;
    localeGeneration += 1;
    pendingLoads.length = 0;
    for (const controller of activeLoads.keys()) controller.abort();
    activeLoads.clear();
  });

  return { imageFor, characterIdFor, reportImageError, tvdbIds };
}
