import { computed, onMounted, reactive, ref, watch, type Ref } from "vue";
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
  let mounted = false;

  async function load(keys: string[], skip: CharacterImageSource[] = []): Promise<void> {
    if (keys.length === 0) return;
    // A stable order keeps the URL, and so the edge cache key, identical for the same cards.
    keys = [...keys].sort();
    skip = [...skip].sort();
    const started = new Map(keys.map((key) => [key, (generations.get(key) ?? 0) + 1]));
    for (const [key, generation] of started) generations.set(key, generation);
    const isCurrent = (key: string) => generations.get(key) === started.get(key);
    try {
      const response = await $fetch<CharacterImagesResponse>("/api/character-images", {
        query: {
          item: keys,
          lang: language.value,
          ...(skip.length > 0 ? { skip: skip.join(",") } : {}),
        },
      });
      tvdbIds.value = { ...tvdbIds.value, ...response.tvdbIds };
      Object.assign(characterIds, response.characterIds);
      for (const key of keys) if (isCurrent(key)) images[key] = response.images[key] ?? null;
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
    // One request per production: the URL then depends only on that production's
    // cards (not on which other cards share the page), so the same card hits the
    // same edge-cache entry from every page, and a provider failure for one
    // production no longer makes the whole page's responses uncacheable.
    const groups = new Map<string, string[]>();
    for (const key of keys) {
      const production = key.split(":", 2).join(":");
      groups.set(production, [...(groups.get(production) ?? []), key]);
    }
    for (const group of groups.values()) {
      for (let index = 0; index < group.length; index += MAX_BATCH) {
        void load(group.slice(index, index + MAX_BATCH));
      }
    }
  }

  function reportImageError(request: CharacterImageRequest): void {
    const key = characterImageKey(request);
    const failed = key ? images[key] : null;
    if (!key || !failed) return;
    const skip = [...(skipped.get(key) ?? []), failed.source];
    skipped.set(key, skip);
    images[key] = null;
    void load([key], skip);
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
  watch(() => currentKeys().join("\n"), loadVisible);

  return { imageFor, characterIdFor, reportImageError, tvdbIds };
}
