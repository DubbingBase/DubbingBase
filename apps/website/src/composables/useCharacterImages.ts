import { computed, onBeforeUnmount, onMounted, reactive, ref, watch, type Ref } from "vue";
import { APP_LOCALES, selectTvdbCharacter } from "@app/shared-logic";
import {
  CHARACTER_PORTRAIT_BATCH_LIMIT,
  type CharacterRoster,
  type CharacterRosterBatch,
} from "#shared/character-portraits";

export type CharacterImage = {
  src: string;
  source: "tvdb";
};

/** One card: the production it belongs to and the role names to look for. */
export type CharacterImageRequest = {
  mediaType: "movie" | "tv";
  mediaId: number | string;
  names: readonly (string | null | undefined)[];
};

/**
 * Resolved portraits survive leaving and re-entering a page (a title, then Back),
 * so cards do not drop to placeholders and refetch every production. Browser-only:
 * nothing is written during server rendering, so no state crosses requests.
 * Found images are kept for the session. "No image" answers are kept briefly,
 * because a missing TVDB image can appear later; failed requests are never kept.
 */
const MISS_TTL_MS = 5 * 60 * 1000;
type SharedCharacterImages = {
  images: Map<string, CharacterImage>;
  misses: Map<string, number>;
  characterIds: Map<string, string>;
  tvdbIds: Map<string, number>;
  /** Complete, healthy TVDB casts by production: later pages match names without a request. */
  rosters: Map<string, CharacterRoster>;
};
const MAX_SHARED_IMAGES = 600;
const MAX_SHARED_ROSTERS = 40;
const sharedByLanguage = new Map<string, SharedCharacterImages>();

function sharedFor(language: string): SharedCharacterImages {
  let shared = sharedByLanguage.get(language);
  if (!shared) {
    shared = {
      images: new Map(),
      misses: new Map(),
      characterIds: new Map(),
      tvdbIds: new Map(),
      rosters: new Map(),
    };
    sharedByLanguage.set(language, shared);
  }
  return shared;
}

/** Test hook: forget every remembered portrait. */
export function resetSharedCharacterImages(): void {
  sharedByLanguage.clear();
}

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

function productionOf(key: string): string {
  return key.split(":", 2).join(":");
}

/** Role names of a card key, in the order they were requested. */
function namesOf(key: string): string[] {
  const first = key.indexOf(":");
  const second = key.indexOf(":", first + 1);
  return key.slice(second + 1).split(NAME_SEPARATOR);
}

/**
 * The one way pages get production-scoped character images (TVDB): lazily,
 * after hydration, only for the cards currently shown. Never blocks SSR.
 *
 * Filmographies can send several production lookups together. Each response cast
 * is reused by production, so later role matches do not require another request.
 * An image that fails to load becomes a placeholder.
 */
export function useCharacterImages(
  requests: Ref<readonly CharacterImageRequest[]>,
  options: { batchProductions?: boolean } = {},
) {
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
    const production = productionOf(key);
    const tvdbId = tvdbIds.value[production];
    if (tvdbId !== undefined) shared.tvdbIds.set(production, tvdbId);
    while (shared.images.size > MAX_SHARED_IMAGES) {
      const oldest = shared.images.keys().next().value;
      if (oldest === undefined) break;
      shared.images.delete(oldest);
      shared.characterIds.delete(oldest);
    }
  }
  // Latest request per card wins, so a slow stale response cannot overwrite a newer one.
  const generations = new Map<string, number>();
  type PendingLoad = {
    production: string;
    keys: string[];
    language: string;
    localeGeneration: number;
  };
  const pendingLoads: PendingLoad[] = [];
  const rosterRequests = new Map<string, Promise<CharacterRoster>>();
  const activeLoads = new Set<AbortController>();
  const batchLimit = options.batchProductions ? CHARACTER_PORTRAIT_BATCH_LIMIT : 1;
  let hasRequestedRoster = false;
  let localeGeneration = 0;
  let mounted = false;
  let active = true;

  /** Shows what the TVDB cast says about each card. */
  function applyRoster(production: string, keys: string[], roster: CharacterRoster): void {
    if (roster.tvdbId !== null) {
      tvdbIds.value = { ...tvdbIds.value, [production]: roster.tvdbId };
    }
    for (const key of keys) {
      const match = selectTvdbCharacter(namesOf(key), roster.characters);
      if (match) characterIds[key] = match.id;
      if (match?.image) images[key] = { src: match.image, source: "tvdb" };
      else images[key] = null;
      remember(key, images[key], !roster.degraded);
      // A degraded answer is not the real one: ask again the next time the card is shown.
      if (roster.degraded && !images[key]) requested.delete(key);
    }
  }

  function requestRosters(productions: Set<string>, signal: AbortSignal): void {
    const [firstProduction] = productions;
    if (!firstProduction) return;

    let response: Promise<CharacterRosterBatch>;
    if (productions.size === 1) {
      const [mediaType, mediaId] = firstProduction.split(":");
      response = $fetch<CharacterRoster>("/api/character-portraits", {
        query: { mediaType, mediaId, lang: language.value },
        signal,
      }).then((roster) => ({ [firstProduction]: roster }));
    } else {
      response = $fetch<CharacterRosterBatch>("/api/character-portraits", {
        query: { productions: [...productions].sort().join(","), lang: language.value },
        signal,
      });
    }
    for (const production of productions) {
      const request = response.then((rosters) => {
        const roster = rosters[production];
        if (!roster) throw new Error("Missing character roster");
        return roster;
      });
      rosterRequests.set(production, request);
      const forget = () => {
        if (rosterRequests.get(production) === request) rosterRequests.delete(production);
      };
      request.then(forget, forget);
    }
  }

  async function loadRoster({
    production,
    keys,
    language: requestLanguage,
    localeGeneration: startedLocale,
  }: PendingLoad): Promise<void> {
    const started = new Map(keys.map((key) => [key, (generations.get(key) ?? 0) + 1]));
    for (const [key, generation] of started) generations.set(key, generation);
    // Paging away does not invalidate a completed production lookup in this locale.
    const isCurrent = (key: string) =>
      active && localeGeneration === startedLocale && generations.get(key) === started.get(key);
    try {
      const store = sharedFor(requestLanguage);
      let roster = store.rosters.get(production);
      if (!roster) {
        roster = await rosterRequests.get(production);
        if (!roster) throw new Error("Missing character roster request");
        if (!roster.degraded && import.meta.client) {
          store.rosters.delete(production);
          store.rosters.set(production, roster);
          while (store.rosters.size > MAX_SHARED_ROSTERS) {
            const oldest = store.rosters.keys().next().value;
            if (oldest === undefined) break;
            store.rosters.delete(oldest);
          }
        }
      }
      const current = keys.filter(isCurrent);
      if (current.length > 0) applyRoster(production, current, roster);
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
      const activeKeys = new Set(currentKeys());
      const loads: PendingLoad[] = [];
      const productions = new Set<string>();
      // The leading portrait can render while another title's batch lookup is still running.
      const limit = hasRequestedRoster ? batchLimit : 1;
      while (productions.size < limit && pendingLoads.length > 0) {
        const pending = pendingLoads.shift();
        if (!pending || pending.localeGeneration !== localeGeneration) continue;
        const keys = pending.keys.filter((key) => activeKeys.has(key) && requested.has(key));
        for (const key of pending.keys) if (!keys.includes(key)) requested.delete(key);
        if (keys.length === 0) continue;
        loads.push({ ...pending, keys });
        if (!shared.rosters.has(pending.production) && !rosterRequests.has(pending.production)) {
          productions.add(pending.production);
        }
      }
      if (loads.length === 0) break;
      const controller = new AbortController();
      activeLoads.add(controller);
      if (productions.size > 0) hasRequestedRoster = true;
      requestRosters(productions, controller.signal);
      void Promise.all(loads.map(loadRoster)).finally(() => {
        activeLoads.delete(controller);
        drainLoads();
      });
    }
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
    // The roster is production-scoped even when its request carries other casts.
    const byProduction = new Map<string, string[]>();
    for (const key of keys) {
      const production = productionOf(key);
      byProduction.set(production, [...(byProduction.get(production) ?? []), key]);
    }
    for (const [production, productionKeys] of byProduction) {
      const roster = shared.rosters.get(production);
      if (roster) {
        applyRoster(production, productionKeys, roster);
        continue;
      }
      pendingLoads.push({
        production,
        keys: productionKeys,
        language: language.value,
        localeGeneration,
      });
    }
    drainLoads();
  }

  /** The browser could not load a card's image: show the placeholder and do not remember it. */
  function reportImageError(request: CharacterImageRequest): void {
    const key = characterImageKey(request);
    if (!key || !images[key]) return;
    images[key] = null;
    remember(key, null, false);
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
    hasRequestedRoster = false;
    pendingLoads.length = 0;
    for (const controller of activeLoads.keys()) controller.abort();
    requested.clear();
    rosterRequests.clear();
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
