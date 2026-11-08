import { onMounted, reactive, watch, type Ref } from "vue";

export type ActorCharacterImageSource = "tvdb" | "wikimedia" | "dubbingbase";

export type ActorCharacterImage = {
  src: string;
  source: ActorCharacterImageSource;
  attribution?: string;
  sourceUrl?: string;
};

type CardRef = { id: number; media_type: "movie" | "tv" };
type CharacterImagesResponse = { images: Record<string, ActorCharacterImage | null> };

const MAX_BATCH = 12;

export const characterImageKey = (item: CardRef): string => `${item.media_type}:${item.id}`;

/**
 * Lazily loads production-scoped character images for the cards currently
 * shown (one page), after hydration. Never blocks SSR and never requests the
 * whole filmography. A failed image is re-requested with its source skipped so
 * the server continues down TVDB → Wikimedia → DubbingBase.
 */
export function useActorCharacterImages(
  actorId: string,
  items: Ref<readonly CardRef[]>,
  language: Ref<string>,
) {
  const images = reactive<Record<string, ActorCharacterImage | null>>({});
  const requested = new Set<string>();
  const skipped = new Map<string, ActorCharacterImageSource[]>();
  // Latest request per card wins, so a slow stale response cannot restore a failed image.
  const generations = new Map<string, number>();
  let mounted = false;

  async function load(keys: string[], skip: ActorCharacterImageSource[] = []): Promise<void> {
    if (keys.length === 0) return;
    const started = new Map(keys.map((key) => [key, (generations.get(key) ?? 0) + 1]));
    for (const [key, generation] of started) generations.set(key, generation);
    const isCurrent = (key: string) => generations.get(key) === started.get(key);
    try {
      const response = await $fetch<CharacterImagesResponse>(
        `/api/actor/${actorId}/character-images`,
        {
          query: {
            items: keys.join(","),
            lang: language.value,
            ...(skip.length > 0 ? { skip: skip.join(",") } : {}),
          },
        },
      );
      for (const key of keys) if (isCurrent(key)) images[key] = response.images[key] ?? null;
    } catch {
      // Provider or network failure: keep the placeholder and allow a later retry.
      for (const key of keys) {
        if (!isCurrent(key)) continue;
        images[key] = null;
        requested.delete(key);
      }
    }
  }

  function loadVisible(): void {
    if (!mounted) return;
    const keys = items.value.map(characterImageKey).filter((key) => !requested.has(key));
    for (const key of keys) requested.add(key);
    // The endpoint is bounded to one page of cards per request.
    for (let index = 0; index < keys.length; index += MAX_BATCH) {
      void load(keys.slice(index, index + MAX_BATCH));
    }
  }

  function reportImageError(item: CardRef): void {
    const key = characterImageKey(item);
    const failed = images[key];
    if (!failed) return;
    const skip = [...(skipped.get(key) ?? []), failed.source];
    skipped.set(key, skip);
    images[key] = null;
    void load([key], skip);
  }

  onMounted(() => {
    mounted = true;
    loadVisible();
  });
  watch(() => items.value.map(characterImageKey).join(","), loadVisible);

  return { images, reportImageError };
}
