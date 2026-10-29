import { useSupabaseAdmin } from "../db/client";
import { TMDBClient } from "../api/tmdb";
import { TVDBClient } from "../api/tvdb";
import { processVoiceActor } from "../urls/supabase";
import { processMedia, cleanCharacterName } from "../urls/tmdb";
import { useCache, useIgdbClient, useOpenLibraryClient } from "../index";
import { buildIgdbImageUrl } from "../api/igdb";
import { createCacheNamespace } from "../cache";
import { buildCacheKey } from "../cache/constants";

const WIKIPEDIA_USER_AGENT = "DubbingBase/1.0 (https://dubbingbase.com; contact@dubbingbase.com)";

interface WikidataClaimsResponse {
  claims?: Record<
    string,
    Array<{
      mainsnak?: {
        datavalue?: { value?: string | number };
      };
    }>
  >;
}

interface TmdbCredit {
  backdrop_path?: string;
  popularity?: number;
}

interface TmdbCastMember {
  id: number;
  name?: string;
  character?: string | null;
  profile_path?: string | null;
}

interface CharacterProfilePicture {
  id: number | string;
  name: string;
  image: string;
  tvdbPeopleId: number | string | null;
  movieId?: number;
  seriesId?: number;
}

interface TvdbSearchResult {
  id: string;
  type?: string;
  name?: string;
  tvdb_id?: number;
  translations?: { eng?: string };
}

interface TvdbCharacter {
  id: number | string;
  name: string;
  image: string;
  peopleId?: number | string | null;
}

type MediaContentType =
  | "movie"
  | "tv"
  | "video_game"
  | "audiobook"
  | "advertisement"
  | "podcast"
  | "toy";

type MediaTarget = { contentType: MediaContentType; contentId: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function omitUnusedEpisodeFields(media: unknown): unknown {
  if (!isRecord(media)) return media;

  const episode = { ...media };
  delete episode.external_ids;
  delete episode.guest_stars;
  if (!isRecord(episode.credits)) return episode;

  const credits = { ...episode.credits };
  delete credits.crew;
  return { ...episode, credits };
}

function projectSeasonForMediaPage(media: unknown): unknown {
  if (!isRecord(media) || !Array.isArray(media.episodes)) return media;

  return {
    ...media,
    episodes: media.episodes.map((episode) => {
      if (!isRecord(episode)) return episode;

      return {
        episode_number: episode.episode_number,
        name: episode.name,
        air_date: episode.air_date,
        still_path: episode.still_path,
        vote_average: episode.vote_average,
      };
    }),
  };
}

function isTvdbSearchResult(value: unknown): value is TvdbSearchResult {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    (value.type === undefined || typeof value.type === "string") &&
    (value.name === undefined || typeof value.name === "string") &&
    (value.tvdb_id === undefined || typeof value.tvdb_id === "number") &&
    (value.translations === undefined ||
      (isRecord(value.translations) &&
        (value.translations.eng === undefined || typeof value.translations.eng === "string")))
  );
}

function isTvdbCharacter(value: unknown): value is TvdbCharacter {
  return (
    isRecord(value) &&
    (typeof value.id === "number" || typeof value.id === "string") &&
    typeof value.name === "string" &&
    typeof value.image === "string" &&
    (value.peopleId === undefined ||
      value.peopleId === null ||
      typeof value.peopleId === "number" ||
      typeof value.peopleId === "string")
  );
}

function isMediaContentType(value: string | null | undefined): value is MediaContentType {
  return (
    value === "movie" ||
    value === "tv" ||
    value === "video_game" ||
    value === "audiobook" ||
    value === "advertisement" ||
    value === "podcast" ||
    value === "toy"
  );
}

function isTmdbCredit(value: unknown): value is TmdbCredit {
  if (!isRecord(value)) return false;
  return (
    (value.backdrop_path === undefined || typeof value.backdrop_path === "string") &&
    (value.popularity === undefined || typeof value.popularity === "number")
  );
}

function sanitizeMediaCastForProcessing(media: unknown): unknown {
  if (!isRecord(media) || !isRecord(media.credits)) return media;

  const cast = Array.isArray(media.credits.cast)
    ? media.credits.cast.filter(
        (credit) =>
          isRecord(credit) &&
          (credit.character === undefined ||
            credit.character === null ||
            typeof credit.character === "string") &&
          (credit.profile_path === undefined ||
            credit.profile_path === null ||
            typeof credit.profile_path === "string"),
      )
    : [];

  return { ...media, credits: { ...media.credits, cast } };
}

function tmdbCastCredits(value: unknown): TmdbCredit[] {
  if (!isRecord(value) || !Array.isArray(value.cast)) return [];
  return value.cast.filter(isTmdbCredit);
}

function indexTmdbCastByActorId(
  media: unknown,
  relevantActorIds: ReadonlySet<number>,
): Map<number, TmdbCastMember> {
  if (!isRecord(media) || !isRecord(media.credits) || !Array.isArray(media.credits.cast)) {
    return new Map();
  }

  const castByActorId = new Map<number, TmdbCastMember>();
  for (const value of media.credits.cast) {
    if (
      !isRecord(value) ||
      typeof value.id !== "number" ||
      !relevantActorIds.has(value.id) ||
      castByActorId.has(value.id)
    ) {
      continue;
    }

    castByActorId.set(value.id, {
      id: value.id,
      ...(typeof value.name === "string" ? { name: value.name } : {}),
      ...(typeof value.character === "string" || value.character === null
        ? { character: value.character }
        : {}),
      ...(typeof value.profile_path === "string" || value.profile_path === null
        ? { profile_path: value.profile_path }
        : {}),
    });
  }

  return castByActorId;
}

export const WIKIPEDIA_ACTOR_URL_NAMESPACE = createCacheNamespace<string | null>();
export const MEDIA_TVDB_CHARACTERS_NAMESPACE = createCacheNamespace<Awaited<
  ReturnType<MediaService["getCharacterProfilePictures"]>
> | null>();

async function fetchPotentialWikipediaUrl(
  firstname: string,
  lastname: string,
  cache: ReturnType<typeof useCache>,
): Promise<string | null> {
  try {
    const name = `${firstname} ${lastname}`.trim();
    if (!name) return null;

    const cacheKey = buildCacheKey({
      provider: "wikipedia",
      resource: "voice-actor-url",
      query: name,
      language: "fr",
    });
    return await cache.getOrFetch(
      WIKIPEDIA_ACTOR_URL_NAMESPACE,
      cacheKey,
      async () => {
        // Search Wikidata for the person
        const searchUrl = `https://wikidata.org/w/api.php?action=wbsearchentities&format=json&search=${encodeURIComponent(name)}&language=fr`;
        const searchRes = await fetch(searchUrl, {
          headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
        });
        if (!searchRes.ok) return null;

        const searchData = await searchRes.json();
        if (!searchData.search || searchData.search.length === 0) return null;

        const bestMatch = searchData.search[0];

        // Get sitelinks for French Wikipedia
        const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks&format=json&ids=${bestMatch.id}&sitefilter=frwiki`;
        const entityRes = await fetch(entityUrl, {
          headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
        });
        if (!entityRes.ok) return null;

        const entityData = await entityRes.json();
        const title = entityData.entities?.[bestMatch.id]?.sitelinks?.frwiki?.title;
        if (!title) return null;

        return `https://fr.wikipedia.org/wiki/${encodeURI(title.replace(/ /g, "_"))}`;
      },
      { ttl: "STABLE", cachePolicy: "persistent" },
    );
  } catch (e) {
    console.error("Failed to fetch potential Wikipedia URL:", e);
    return null;
  }
}

export class MediaService {
  constructor(
    private tmdbClient: TMDBClient,
    private acceptLanguage?: string,
  ) {}

  async getVoiceActorWithWorkAndMedia(voiceActorId: number, language?: string) {
    const supabase = useSupabaseAdmin();

    const { data: voiceActor, error: vaError } = await supabase
      .from("voice_actors")
      .select(
        "*, work(id, actor_id, performance, note, character_name, dubbing_projects(content_id, content_type, studios(id, name, logo_url)))",
      )
      .eq("id", voiceActorId)
      .single();

    if (vaError || !voiceActor) throw new Error("Voice actor not found");

    const voiceActorWithImages = processVoiceActor(voiceActor);
    const workItems = voiceActor.work || [];
    const relevantActorIds = new Set<number>();
    for (const work of workItems) {
      if (typeof work.actor_id === "number") relevantActorIds.add(work.actor_id);
    }

    // 1. Deduplicate media requests by (contentType + contentId)
    const uniqueTargetsMap = new Map<string, MediaTarget>();
    for (const work of workItems) {
      const contentId = work.dubbing_projects?.content_id;
      const contentType = work.dubbing_projects?.content_type;
      if (contentId && isMediaContentType(contentType)) {
        uniqueTargetsMap.set(`${contentType}:${contentId}`, {
          contentType,
          contentId,
        });
      }
    }
    const uniqueTargets = Array.from(uniqueTargetsMap.values());

    // 2. Fetch unique media items with a concurrency-limited pool.
    // Serial batches stall on the slowest straggler; a pool keeps CONCURRENCY
    // requests in flight and starts the next target as soon as one finishes.
    const CONCURRENCY = 15;

    // Independent tail work (backdrop person credits, Wikipedia fallback)
    // starts now so it overlaps the media fan-out instead of running after it.
    const tmdbPersonPromise = voiceActor.tmdb_id
      ? this.tmdbClient
          .get(
            `person/${voiceActor.tmdb_id}`,
            { append_to_response: "movie_credits,tv_credits" },
            language,
          )
          .catch((e) => {
            console.error("Failed to compute voice actor backdrop:", e);
            return null;
          })
      : null;
    const wikipediaPromise =
      !voiceActor.tmdb_id && voiceActor.firstname && voiceActor.lastname
        ? fetchPotentialWikipediaUrl(voiceActor.firstname, voiceActor.lastname, useCache()).catch(
            () => null,
          )
        : Promise.resolve(null);

    const fetchTarget = async ({ contentType, contentId }: MediaTarget) => {
      if (contentType === "audiobook") {
        try {
          const openLibraryClient = useOpenLibraryClient();
          const book = await openLibraryClient.getBook(contentId);
          if (!book) {
            return {
              key: `${contentType}:${contentId}`,
              data: {
                media: null,
                characterProfilePictures: new Array<CharacterProfilePicture>(),
                tvdbId: null,
              },
            };
          }
          const processedBook = {
            id: book.id,
            title: book.title,
            name: book.title,
            overview: book.description || "",
            poster_path: book.cover_url || null,
            backdrop_path: null,
            release_date:
              book.release_date ||
              (book.first_publish_year ? `${book.first_publish_year}-01-01` : "1970-01-01"),
            first_air_date:
              book.release_date ||
              (book.first_publish_year ? `${book.first_publish_year}-01-01` : "1970-01-01"),
            media_type: "audiobook" as const,
            popularity: book.popularity || 0,
            credits: { cast: [] },
          };
          return {
            key: `${contentType}:${contentId}`,
            data: {
              media: processedBook,
              characterProfilePictures: new Array<CharacterProfilePicture>(),
              tvdbId: null,
            },
          };
        } catch (err) {
          console.error(`Failed to fetch OpenLibrary book ${contentId} for voice actor:`, err);
          return {
            key: `${contentType}:${contentId}`,
            data: {
              media: null,
              characterProfilePictures: new Array<CharacterProfilePicture>(),
              tvdbId: null,
            },
          };
        }
      }

      if (contentType === "video_game") {
        try {
          const igdbClient = useIgdbClient();
          const game = await igdbClient.getGame(contentId);
          if (!game) {
            return {
              key: `${contentType}:${contentId}`,
              data: {
                media: null,
                characterProfilePictures: new Array<CharacterProfilePicture>(),
                tvdbId: null,
              },
            };
          }
          const processedGame = {
            id: game.id,
            title: game.name,
            name: game.name,
            overview: game.summary || "",
            poster_path: game.cover ? buildIgdbImageUrl(game.cover.image_id, "cover_big") : null,
            backdrop_path: game.artworks?.[0]
              ? buildIgdbImageUrl(game.artworks[0].image_id, "1080p")
              : game.screenshots?.[0]
                ? buildIgdbImageUrl(game.screenshots[0].image_id, "screenshot_huge")
                : null,
            release_date: game.first_release_date
              ? new Date(game.first_release_date * 1000).toISOString().split("T")[0]
              : "1970-01-01",
            first_air_date: game.first_release_date
              ? new Date(game.first_release_date * 1000).toISOString().split("T")[0]
              : "1970-01-01",
            media_type: "video_game" as const,
            popularity: 0,
            credits: { cast: [] },
          };
          return {
            key: `${contentType}:${contentId}`,
            data: {
              media: processedGame,
              characterProfilePictures: new Array<CharacterProfilePicture>(),
              tvdbId: null,
            },
          };
        } catch (err) {
          console.error(`Failed to fetch IGDB game ${contentId} for voice actor:`, err);
          return {
            key: `${contentType}:${contentId}`,
            data: {
              media: null,
              characterProfilePictures: new Array<CharacterProfilePicture>(),
              tvdbId: null,
            },
          };
        }
      }

      if (contentType === "podcast") {
        try {
          const podcastClient = usePodcastClient();
          const podcast = await podcastClient.getPodcast(contentId);
          if (!podcast) {
            return {
              key: `${contentType}:${contentId}`,
              data: {
                media: null,
                characterProfilePictures: new Array<CharacterProfilePicture>(),
                tvdbId: null,
              },
            };
          }
          const processedPodcast = {
            id: podcast.id,
            title: podcast.title,
            name: podcast.title,
            overview: podcast.description || "",
            poster_path: podcast.cover_url || null,
            backdrop_path: null,
            release_date: podcast.release_date || "1970-01-01",
            first_air_date: podcast.release_date || "1970-01-01",
            media_type: "podcast" as const,
            popularity: podcast.popularity || 0,
            credits: { cast: [] },
          };
          return {
            key: `${contentType}:${contentId}`,
            data: {
              media: processedPodcast,
              characterProfilePictures: new Array<CharacterProfilePicture>(),
              tvdbId: null,
            },
          };
        } catch (err) {
          console.error(`Failed to fetch podcast ${contentId}:`, err);
          return {
            key: `${contentType}:${contentId}`,
            data: {
              media: null,
              characterProfilePictures: new Array<CharacterProfilePicture>(),
              tvdbId: null,
            },
          };
        }
      }

      if (contentType === "advertisement") {
        try {
          const adClient = useAdvertisementClient();
          const ad = await adClient.getAdvertisement(contentId);
          const processedAd = {
            id: ad?.id || contentId,
            title: ad?.title || `Spot Publicitaire #${contentId}`,
            name: ad?.title || `Spot Publicitaire #${contentId}`,
            overview: ad?.description || "",
            poster_path: ad?.poster_url || null,
            backdrop_path: null,
            release_date: ad?.year ? `${ad.year}-01-01` : "1970-01-01",
            first_air_date: ad?.year ? `${ad.year}-01-01` : "1970-01-01",
            media_type: "advertisement" as const,
            popularity: 0,
            credits: { cast: [] },
          };
          return {
            key: `${contentType}:${contentId}`,
            data: {
              media: processedAd,
              characterProfilePictures: new Array<CharacterProfilePicture>(),
              tvdbId: null,
            },
          };
        } catch (err) {
          console.error(`Failed to fetch ad ${contentId}:`, err);
          return {
            key: `${contentType}:${contentId}`,
            data: {
              media: null,
              characterProfilePictures: new Array<CharacterProfilePicture>(),
              tvdbId: null,
            },
          };
        }
      }

      if (contentType === "toy") {
        try {
          const toyClient = useToyClient();
          const toy = await toyClient.getToy(contentId);
          const processedToy = {
            id: toy?.id || contentId,
            title: toy?.name || `Objet Connecté #${contentId}`,
            name: toy?.name || `Objet Connecté #${contentId}`,
            overview: toy?.description || "",
            poster_path: toy?.cover_url || null,
            backdrop_path: null,
            release_date: toy?.release_year ? `${toy.release_year}-01-01` : "1970-01-01",
            first_air_date: toy?.release_year ? `${toy.release_year}-01-01` : "1970-01-01",
            media_type: "toy" as const,
            popularity: 0,
            credits: { cast: [] },
          };
          return {
            key: `${contentType}:${contentId}`,
            data: {
              media: processedToy,
              characterProfilePictures: new Array<CharacterProfilePicture>(),
              tvdbId: null,
            },
          };
        } catch (err) {
          console.error(`Failed to fetch toy ${contentId}:`, err);
          return {
            key: `${contentType}:${contentId}`,
            data: {
              media: null,
              characterProfilePictures: new Array<CharacterProfilePicture>(),
              tvdbId: null,
            },
          };
        }
      }

      try {
        const tmdbType = contentType === "tv" ? "tv" : "movie";
        const tmdbMedia = await this.tmdbClient.getMediaWithCredits(
          tmdbType,
          contentId,
          language || this.acceptLanguage,
        );

        // ponytail: no TVDB character lookup here. It costs up to 3 slow
        // requests per media (Wikidata + TVDB search + TVDB fetch) and resolved
        // 0 images across 130+ sampled works. Detail pages keep their own
        // single lookup via getCharacterProfilePictures; add a lazy endpoint
        // if thumbnails ever matter here.
        return {
          key: `${contentType}:${contentId}`,
          data: {
            media: processMedia(sanitizeMediaCastForProcessing(tmdbMedia)),
            characterProfilePictures: new Array<CharacterProfilePicture>(),
            tvdbId: null,
          },
        };
      } catch (err) {
        console.error(`Failed to fetch TMDB ${contentType} ${contentId} for voice actor:`, err);
        return {
          key: `${contentType}:${contentId}`,
          data: {
            media: null,
            characterProfilePictures: new Array<CharacterProfilePicture>(),
            tvdbId: null,
          },
        };
      }
    };

    type FetchTargetData = Awaited<ReturnType<typeof fetchTarget>>["data"];
    const fetchedResultsMap = new Map<string, FetchTargetData>();

    let nextIndex = 0;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, uniqueTargets.length) }, async () => {
        while (true) {
          const idx = nextIndex++;
          if (idx >= uniqueTargets.length) return;
          const target = uniqueTargets[idx];
          if (!target) return;
          const res = await fetchTarget(target);
          if (res?.data) fetchedResultsMap.set(res.key, res.data);
        }
      }),
    );

    // 3. Construct compact enhancedWorks on the server (avoids sending massive raw cast lists)
    const enhancedWorks = [];
    const compactMediasMap = new Map<
      number,
      {
        id: number;
        title: string;
        name: string;
        poster_path: string | null;
        backdrop_path: string | null;
        release_date: string | undefined;
        first_air_date: string | undefined;
        media_type: string;
        popularity: number;
        credits?: { cast?: TmdbCastMember[] };
      }
    >();
    const castByMediaAndActorId = new Map<string, Map<number, TmdbCastMember>>();

    for (const work of workItems) {
      const contentId = work.dubbing_projects?.content_id;
      const contentType = work.dubbing_projects?.content_type;
      if (!contentId || !isMediaContentType(contentType)) continue;

      const mediaResult = fetchedResultsMap.get(`${contentType}:${contentId}`);
      if (!mediaResult || !mediaResult.media) continue;

      const fullMedia = mediaResult.media;
      const mediaKey = `${contentType}:${contentId}`;
      let castByActorId = castByMediaAndActorId.get(mediaKey);
      if (!castByActorId) {
        castByActorId = indexTmdbCastByActorId(fullMedia, relevantActorIds);
        castByMediaAndActorId.set(mediaKey, castByActorId);
      }

      let actorData: {
        id: number;
        name: string | undefined;
        character: string | null | undefined;
        profile_picture: string | undefined;
      } = {
        id: work.actor_id || 0,
        name: "",
        character: "",
        profile_picture: undefined,
      };
      let characterName = work.character_name || undefined;
      let characterImage: string | undefined;

      const castMember =
        typeof work.actor_id === "number" ? castByActorId.get(work.actor_id) : undefined;
      if (castMember) {
        actorData = {
          id: castMember.id,
          name: castMember.name,
          character: castMember.character,
          profile_picture: castMember.profile_path || undefined,
        };
        if (!characterName) {
          characterName = castMember.character || undefined;
        }
      }

      if (
        mediaResult.characterProfilePictures &&
        mediaResult.characterProfilePictures.length > 0 &&
        characterName
      ) {
        const lowerChar = characterName.toLowerCase();
        const pic = mediaResult.characterProfilePictures.find(
          (cp) =>
            (cp.movieId === contentId || cp.seriesId === contentId) &&
            cp.name &&
            cp.name.toLowerCase() === lowerChar,
        );
        if (pic) {
          characterImage = pic.image || undefined;
        }
      }

      const sortDate = fullMedia.release_date || fullMedia.first_air_date || "9999-12-31";

      const compactMedia = {
        id: fullMedia.id,
        title: fullMedia.title || fullMedia.name || "Unknown",
        name: fullMedia.name || fullMedia.title || "Unknown",
        poster_path: fullMedia.poster_path || null,
        backdrop_path: fullMedia.backdrop_path || null,
        release_date: fullMedia.release_date,
        first_air_date: fullMedia.first_air_date,
        media_type: contentType,
        popularity: fullMedia.popularity || 0,
      };

      if (!compactMediasMap.has(fullMedia.id)) {
        compactMediasMap.set(fullMedia.id, compactMedia);
      }

      const searchText =
        `${compactMedia.title} ${characterName || ""} ${actorData.name || ""} ${work.performance || ""}`.toLowerCase();

      enhancedWorks.push({
        work: {
          id: work.id,
          actor_id: work.actor_id,
          performance: work.performance,
          note: work.note,
          dubbing_projects: work.dubbing_projects,
        },
        media: compactMedia,
        data: {
          character: characterName,
          characterImage,
          actor: actorData,
        },
        sortDate,
        searchText,
      });
    }

    // 4. Compute backdrop from most popular TMDB credit
    // (person fetch already ran concurrently with the media fan-out above)
    let backdropPath: string | null = null;
    try {
      if (voiceActor.tmdb_id) {
        const personData = await tmdbPersonPromise;
        if (personData) {
          const allCredits = [
            ...tmdbCastCredits(personData.movie_credits),
            ...tmdbCastCredits(personData.tv_credits),
          ];
          allCredits.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
          const best = allCredits.find((c) => c.backdrop_path);
          if (best) backdropPath = buildTmdbImageUrl(best.backdrop_path, "original");
        }
      } else {
        const sorted = [...enhancedWorks].sort(
          (a, b) => (b.media.popularity || 0) - (a.media.popularity || 0),
        );
        const best = sorted.find((w) => w.media.backdrop_path);
        if (best) backdropPath = best.media.backdrop_path || null;
      }
    } catch (e) {
      console.error("Failed to compute voice actor backdrop:", e);
    }

    // 5. Wikipedia URL already resolved concurrently (null when TMDB ID exists)
    const potentialWikipediaUrl: string | null = await wikipediaPromise;

    return {
      voiceActor: voiceActorWithImages,
      enhancedWorks,
      medias: Array.from(compactMediasMap.values()),
      characterProfilePictures: new Array<CharacterProfilePicture>(),
      potentialWikipediaUrl,
      backdropPath,
    };
  }

  async getCharacterProfilePictures(
    contentType: "movie" | "tv",
    contentId: number,
    tmdbMedia: unknown,
  ): Promise<{ characters: CharacterProfilePicture[]; tvdbId: number | null }> {
    const tmdbData = isRecord(tmdbMedia) ? tmdbMedia : {};
    const cache = useCache();
    const tvdbClient = new TVDBClient(cache);
    const normalizedLanguage = this.acceptLanguage
      ? (this.acceptLanguage.split(",")[0] || "en").trim()
      : "default";
    const cacheKey = buildCacheKey({
      provider: "tvdb",
      resource: "characters-by-tmdb-id",
      id: contentId,
      language: normalizedLanguage,
      params: { contentType },
    });

    try {
      const result = await cache.getOrFetch(
        MEDIA_TVDB_CHARACTERS_NAMESPACE,
        cacheKey,
        async () => {
          let tvdbId: number | null = null;
          const externalIds = isRecord(tmdbData.external_ids) ? tmdbData.external_ids : {};
          if (typeof externalIds.tvdb_id === "number") {
            tvdbId = externalIds.tvdb_id;
          }

          if (!tvdbId && typeof externalIds.wikidata_id === "string") {
            const wikidataId = externalIds.wikidata_id;
            try {
              const url = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${wikidataId}&format=json`;
              const response = await fetch(url, {
                headers: { "User-Agent": WIKIPEDIA_USER_AGENT },
              });
              const data: WikidataClaimsResponse | null = response.ok
                ? await response.json()
                : null;

              const property = contentType === "movie" ? "P12196" : "P4835";
              const claim = data?.claims?.[property]?.[0];
              const claimValue = claim?.mainsnak?.datavalue?.value;
              if (claimValue !== undefined) {
                tvdbId = parseInt(String(claimValue), 10);
              }
            } catch (e) {
              console.error(`Failed to fetch Wikidata for ${wikidataId}`, e);
            }
          }

          if (!tvdbId) {
            const searchQuery = [
              tmdbData.title,
              tmdbData.name,
              tmdbData.original_title,
              tmdbData.original_name,
            ].find((value): value is string => typeof value === "string");

            if (!searchQuery) return null;
            const searchResponse: unknown = await tvdbClient.searchSeries(
              searchQuery,
              this.acceptLanguage,
            );

            if (isRecord(searchResponse) && Array.isArray(searchResponse.data)) {
              const searchResults = searchResponse.data.filter(isTvdbSearchResult);
              const typeMatchedResults = searchResults.filter(
                (item) =>
                  item.type === contentType ||
                  (contentType === "movie" && item.id.startsWith("movie-")) ||
                  (contentType === "tv" && item.id.startsWith("series-")),
              );

              const bestMatch =
                typeMatchedResults.find(
                  (item) =>
                    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.translations?.eng?.toLowerCase().includes(searchQuery.toLowerCase()),
                ) || typeMatchedResults[0];

              const id =
                contentType === "movie" ? (bestMatch?.tvdb_id ?? bestMatch?.id) : bestMatch?.id;
              if (typeof id === "number") tvdbId = id;
              else if (typeof id === "string") {
                const parsedId = Number(id.replace(/^(movie|series)-/, ""));
                if (Number.isInteger(parsedId)) tvdbId = parsedId;
              }
            }
          }

          if (tvdbId) {
            let characters: unknown[] = [];
            if (contentType === "movie") {
              const res = await tvdbClient.getMovieById(
                tvdbId,
                { meta: "translations", short: false },
                this.acceptLanguage,
              );
              characters = Array.isArray(res.data.characters) ? res.data.characters : [];
            } else {
              const res = await tvdbClient.getSeriesById(
                tvdbId,
                { meta: "episodes", short: false },
                this.acceptLanguage,
              );
              characters = Array.isArray(res.data.characters) ? res.data.characters : [];
            }

            const characterProfilePictures = characters
              .filter(isTvdbCharacter)
              .map((character) => ({
                id: character.id,
                name: cleanCharacterName(character.name),
                image: character.image,
                tvdbPeopleId: character.peopleId ?? null,
                movieId: contentType === "movie" ? contentId : undefined,
                seriesId: contentType === "tv" ? contentId : undefined,
              }));

            return { characters: characterProfilePictures, tvdbId };
          }

          return null;
        },
        { cachePolicy: "persistent", ttl: "STABLE" },
      );
      if (result) return result;
    } catch (e) {
      console.error(
        `Error fetching character profile pictures for ${contentType} ${contentId}:`,
        e,
      );
    }

    return { characters: [], tvdbId: null };
  }

  async getMediaWithVoiceActors(
    contentType: "movie" | "tv",
    contentId: number,
    options: { includeCollection?: boolean; includeCreditsCrew?: boolean } = {},
  ) {
    let media =
      contentType === "movie"
        ? await this.tmdbClient.getMediaWithCredits(contentType, contentId, this.acceptLanguage)
        : await this.tmdbClient.getMediaDetails(contentType, contentId, this.acceptLanguage);

    if (options.includeCreditsCrew === false && isRecord(media.credits)) {
      const credits = { ...media.credits };
      delete credits.crew;
      media = { ...media, credits };
    }

    let collection: Record<string, unknown> | null = null;
    const belongsToCollection = media.belongs_to_collection;
    const collectionId = isRecord(belongsToCollection) ? belongsToCollection.id : undefined;
    if (
      options.includeCollection !== false &&
      contentType === "movie" &&
      typeof collectionId === "number"
    ) {
      const collectionData = await this.tmdbClient.getCollection(collectionId);
      if (collectionData) {
        const parts = Array.isArray(collectionData.parts)
          ? collectionData.parts.filter(isRecord)
          : [];
        collection = {
          ...collectionData,
          backdrop_path:
            typeof collectionData.backdrop_path === "string"
              ? `https://image.tmdb.org/t/p/w500${collectionData.backdrop_path}`
              : null,
          poster_path:
            typeof collectionData.poster_path === "string"
              ? `https://image.tmdb.org/t/p/w500${collectionData.poster_path}`
              : null,
          parts: parts.map((part) => ({
            ...part,
            backdrop_path:
              typeof part.backdrop_path === "string"
                ? `https://image.tmdb.org/t/p/w500${part.backdrop_path}`
                : null,
            poster_path:
              typeof part.poster_path === "string"
                ? `https://image.tmdb.org/t/p/w500${part.poster_path}`
                : null,
          })),
        };
      }
    }

    const processedMedia = processMedia(media);

    return { media: processedMedia, collection };
  }

  async getMediaWithVoiceActorsExtended(
    contentType: "movie" | "tv" | "season" | "episode",
    id: number,
    seasonNumber?: number,
    episodeNumber?: number,
    options: { includeCredits?: boolean; projection?: "media-page" } = {},
  ) {
    let media;

    switch (contentType) {
      case "movie":
        media = await this.tmdbClient.getMediaWithCredits("movie", id, this.acceptLanguage);
        break;
      case "tv":
        media = await this.tmdbClient.getMediaWithCredits("tv", id, this.acceptLanguage);
        break;
      case "season":
        if (seasonNumber === undefined || seasonNumber === null || isNaN(seasonNumber)) {
          throw new Error("seasonNumber required");
        }
        media =
          options.includeCredits === false
            ? await this.tmdbClient.getSeason(id, seasonNumber, this.acceptLanguage)
            : await this.tmdbClient.getSeasonWithCredits(id, seasonNumber, this.acceptLanguage);
        break;
      case "episode":
        if (
          seasonNumber === undefined ||
          seasonNumber === null ||
          isNaN(seasonNumber) ||
          episodeNumber === undefined ||
          episodeNumber === null ||
          isNaN(episodeNumber)
        ) {
          throw new Error("seasonNumber and episodeNumber required");
        }
        media = await this.tmdbClient.getEpisodeWithCredits(
          id,
          seasonNumber,
          episodeNumber,
          this.acceptLanguage,
          { includeExternalIds: options.projection !== "media-page" },
        );
        if (options.projection === "media-page") {
          media = omitUnusedEpisodeFields(media);
        }
        break;
    }

    const mediaForProcessing =
      contentType === "season" && options.projection === "media-page"
        ? projectSeasonForMediaPage(media)
        : media;
    const processedMedia = processMedia(mediaForProcessing);
    return { media: processedMedia };
  }
}
