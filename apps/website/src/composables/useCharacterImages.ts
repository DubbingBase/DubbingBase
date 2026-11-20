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

/**
 * Resolved portraits survive leaving and re-entering a page (a title, then Back),
 * so cards do not drop to placeholders and refetch every production. Browser-only:
 * nothing is written during server rendering, so no state crosses requests.
 * Found images are kept for the session. "No image" answers are kept briefly,
 * because the response does not say whether a provider failure produced them;
 * failed requests are never kept.
 */
const MISS_TTL_MS = 5 * 60 * 1000;
type SharedCharacterImages = {
  images: Map<string, CharacterImage>;
  misses: Map<string, number>;
  characterIds: Map<string, string>;
  tvdbIds: Map<string, number>;
};
const MAX_SHARED_IMAGES = 600;
const sharedByLanguage = new Map<string, SharedCharacterImages>();

function sharedFor(language: string): SharedCharacterImages {
  let shared = sharedByLanguage.get(language);
  if (!shared) {
    shared = { images: new Map(), misses: new Map(), characterIds: new Map(), tvdbIds: new Map() };
    sharedByLanguage.set(language, shared);
  }
  return shared;
}

/** Test hook: forget every remembered portrait. */
export function resetSharedCharacterImages(): void {
  sharedByLanguage.clear();
}

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
  let shared = sharedFor(language.value);

  /** Seeds this instance from what earlier pages already resolved in this locale. */
  function seedFromShared(): void {
    if (!import.meta.client) return;
    for (const [key, image] of shared.images) {
      images[key] = image;
      requested.add(key);
      const characterId = shared.characterIds.get(key);
      if (characterId !== undefined) characterIds[key] = characterId;
    }
    const now = Date.now();
    for (const [key, at] of shared.misses) {
      if (now - at > MISS_TTL_MS) {
        shared.misses.delete(key);
        continue;
      }
      if (key in images) continue;
      images[key] = null;
      requested.add(key);
    }
    tvdbIds.value = Object.fromEntries(shared.tvdbIds);
  }

  /** `answered`: the server replied (even "no image"); false when the image failed in the browser. */
  function remember(key: string, image: CharacterImage | null, answered = true): void {
    if (!import.meta.client) return;
    if (!image) {
      shared.images.delete(key);
      if (answered) {
        shared.misses.delete(key);
        shared.misses.set(key, Date.now());
        while (shared.misses.size > MAX_SHARED_IMAGES) {
          const oldest = shared.misses.keys().next().value;
          if (oldest === undefined) break;
          shared.misses.delete(oldest);
        }
      } else shared.misses.delete(key);
      return;
    }
    shared.misses.delete(key);
    shared.images.delete(key);
    shared.images.set(key, image);
    const characterId = characterIds[key];
    if (characterId !== undefined) shared.characterIds.set(key, characterId);
    const production = key.split(":", 2).join(":");
    const tvdbId = tvdbIds.value[production];
    if (tvdbId !== undefined) shared.tvdbIds.set(production, tvdbId);
    while (shared.images.size > MAX_SHARED_IMAGES) {
      const oldest = shared.images.keys().next().value;
      if (oldest === undefined) break;
      shared.images.delete(oldest);
      shared.characterIds.delete(oldest);
    }
  }
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
      for (const key of responseKeys) {
        images[key] = response.images[key] ?? null;
        remember(key, images[key]);
      }
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
    remember(key, null, false);
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
    // After hydration: seeding earlier would not match the server-rendered placeholders.
    seedFromShared();
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
    shared = sharedFor(language.value);
    seedFromShared();
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
