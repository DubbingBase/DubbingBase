import { useSupabaseAdmin } from "../db/client";
import { TMDBClient } from "../api/tmdb";
import { TVDBClient } from "../api/tvdb";
import { processVoiceActor } from "../urls/supabase";
import { processMedia, cleanCharacterName } from "../urls/tmdb";
import { useCache, useIgdbClient, useOpenLibraryClient } from "../index";
import { buildIgdbImageUrl } from "../api/igdb";

const WIKIPEDIA_USER_AGENT =
  "DubbingBase/1.0 (https://dubbingbase.com; contact@dubbingbase.com)";

async function fetchPotentialWikipediaUrl(
  firstname: string,
  lastname: string,
): Promise<string | null> {
  try {
    const name = `${firstname} ${lastname}`.trim();
    if (!name) return null;

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
        "*, work(id, actor_id, performance, character_name, dubbing_projects(content_id, content_type, studios(id, name, logo_url)))",
      )
      .eq("id", voiceActorId)
      .single();

    if (vaError || !voiceActor) throw new Error("Voice actor not found");

    const voiceActorWithImages = processVoiceActor(voiceActor);
    const workItems = (voiceActor as any).work || [];

    // 1. Deduplicate media requests by (contentType + contentId)
    type MediaTarget = {
      contentType:
        | "movie"
        | "tv"
        | "video_game"
        | "audiobook"
        | "advertisement"
        | "podcast"
        | "toy";
      contentId: number;
    };
    const uniqueTargetsMap = new Map<string, MediaTarget>();
    for (const work of workItems) {
      const contentId = work.dubbing_projects?.content_id;
      const contentType = work.dubbing_projects?.content_type as
        | "movie"
        | "tv"
        | "video_game"
        | "audiobook"
        | "advertisement"
        | "podcast"
        | "toy";
      if (contentId && contentType) {
        uniqueTargetsMap.set(`${contentType}:${contentId}`, {
          contentType,
          contentId,
        });
      }
    }
    const uniqueTargets = Array.from(uniqueTargetsMap.values());

    // 2. Fetch unique media items in batches to prevent socket exhaustion and rate limits
    const fetchedResultsMap = new Map<
      string,
      { media: any; characterProfilePictures: any[]; tvdbId: number | null }
    >();

    const BATCH_SIZE = 15;
    for (let i = 0; i < uniqueTargets.length; i += BATCH_SIZE) {
      const batch = uniqueTargets.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async ({ contentType, contentId }) => {
          if (contentType === "audiobook") {
            try {
              const openLibraryClient = useOpenLibraryClient();
              const book = await openLibraryClient.getBook(contentId);
              if (!book) {
                return {
                  key: `${contentType}:${contentId}`,
                  data: {
                    media: null,
                    characterProfilePictures: [],
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
                  (book.first_publish_year
                    ? `${book.first_publish_year}-01-01`
                    : "1970-01-01"),
                first_air_date:
                  book.release_date ||
                  (book.first_publish_year
                    ? `${book.first_publish_year}-01-01`
                    : "1970-01-01"),
                media_type: "audiobook" as const,
                popularity: book.popularity || 0,
                credits: { cast: [] },
              };
              return {
                key: `${contentType}:${contentId}`,
                data: {
                  media: processedBook,
                  characterProfilePictures: [],
                  tvdbId: null,
                },
              };
            } catch (err) {
              console.error(
                `Failed to fetch OpenLibrary book ${contentId} for voice actor:`,
                err,
              );
              return {
                key: `${contentType}:${contentId}`,
                data: {
                  media: null,
                  characterProfilePictures: [],
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
                    characterProfilePictures: [],
                    tvdbId: null,
                  },
                };
              }
              const processedGame = {
                id: game.id,
                title: game.name,
                name: game.name,
                overview: game.summary || "",
                poster_path: game.cover
                  ? buildIgdbImageUrl(game.cover.image_id, "cover_big")
                  : null,
                backdrop_path: game.artworks?.[0]
                  ? buildIgdbImageUrl(game.artworks[0].image_id, "1080p")
                  : game.screenshots?.[0]
                    ? buildIgdbImageUrl(
                        game.screenshots[0].image_id,
                        "screenshot_huge",
                      )
                    : null,
                release_date: game.first_release_date
                  ? new Date(game.first_release_date * 1000)
                      .toISOString()
                      .split("T")[0]
                  : "1970-01-01",
                first_air_date: game.first_release_date
                  ? new Date(game.first_release_date * 1000)
                      .toISOString()
                      .split("T")[0]
                  : "1970-01-01",
                media_type: "video_game" as const,
                popularity: 0,
                credits: { cast: [] },
              };
              return {
                key: `${contentType}:${contentId}`,
                data: {
                  media: processedGame,
                  characterProfilePictures: [],
                  tvdbId: null,
                },
              };
            } catch (err) {
              console.error(
                `Failed to fetch IGDB game ${contentId} for voice actor:`,
                err,
              );
              return {
                key: `${contentType}:${contentId}`,
                data: {
                  media: null,
                  characterProfilePictures: [],
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
                    characterProfilePictures: [],
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
                  characterProfilePictures: [],
                  tvdbId: null,
                },
              };
            } catch (err) {
              console.error(`Failed to fetch podcast ${contentId}:`, err);
              return {
                key: `${contentType}:${contentId}`,
                data: {
                  media: null,
                  characterProfilePictures: [],
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
                  characterProfilePictures: [],
                  tvdbId: null,
                },
              };
            } catch (err) {
              console.error(`Failed to fetch ad ${contentId}:`, err);
              return {
                key: `${contentType}:${contentId}`,
                data: {
                  media: null,
                  characterProfilePictures: [],
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
                release_date: toy?.release_year
                  ? `${toy.release_year}-01-01`
                  : "1970-01-01",
                first_air_date: toy?.release_year
                  ? `${toy.release_year}-01-01`
                  : "1970-01-01",
                media_type: "toy" as const,
                popularity: 0,
                credits: { cast: [] },
              };
              return {
                key: `${contentType}:${contentId}`,
                data: {
                  media: processedToy,
                  characterProfilePictures: [],
                  tvdbId: null,
                },
              };
            } catch (err) {
              console.error(`Failed to fetch toy ${contentId}:`, err);
              return {
                key: `${contentType}:${contentId}`,
                data: {
                  media: null,
                  characterProfilePictures: [],
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

            const { characters, tvdbId } =
              await this.getCharacterProfilePictures(
                tmdbType,
                contentId,
                tmdbMedia,
              );

            return {
              key: `${contentType}:${contentId}`,
              data: {
                media: processMedia(tmdbMedia),
                characterProfilePictures: characters,
                tvdbId,
              },
            };
          } catch (err) {
            console.error(
              `Failed to fetch TMDB ${contentType} ${contentId} for voice actor:`,
              err,
            );
            return {
              key: `${contentType}:${contentId}`,
              data: {
                media: null,
                characterProfilePictures: [],
                tvdbId: null,
              },
            };
          }
        }),
      );

      for (const res of batchResults) {
        if (res?.data) {
          fetchedResultsMap.set(res.key, res.data);
        }
      }
    }

    // 3. Construct compact enhancedWorks on the server (avoids sending massive raw cast lists)
    const enhancedWorks = [];
    const compactMediasMap = new Map<number, any>();

    for (const work of workItems) {
      const contentId = work.dubbing_projects?.content_id;
      const contentType = work.dubbing_projects?.content_type as
        "movie" | "tv" | "video_game" | "audiobook";
      if (!contentId || !contentType) continue;

      const mediaResult = fetchedResultsMap.get(`${contentType}:${contentId}`);
      if (!mediaResult || !mediaResult.media) continue;

      const fullMedia = mediaResult.media;

      let actorData = {
        id: work.actor_id || 0,
        name: "",
        character: "",
        profile_picture: undefined as string | undefined,
      };
      let characterName = work.character_name || undefined;
      let characterImage: string | undefined;

      if (fullMedia.credits?.cast) {
        const castMember = fullMedia.credits.cast.find(
          (c: any) => c.id === work.actor_id,
        );
        if (castMember) {
          actorData = {
            id: castMember.id,
            name: castMember.name,
            character: castMember.character,
            profile_picture: castMember.profile_path || undefined,
          };
          if (!characterName) {
            characterName = castMember.character;
          }
        }
      }

      if (
        mediaResult.characterProfilePictures &&
        mediaResult.characterProfilePictures.length > 0 &&
        characterName
      ) {
        const lowerChar = characterName.toLowerCase();
        const pic = mediaResult.characterProfilePictures.find(
          (cp: any) =>
            (cp.movieId === contentId || cp.showId === contentId) &&
            cp.name &&
            cp.name.toLowerCase() === lowerChar,
        );
        if (pic) {
          characterImage = pic.image || pic.profile_path || undefined;
        }
      }

      const sortDate =
        fullMedia.release_date || fullMedia.first_air_date || "9999-12-31";

      const compactMedia = {
        id: fullMedia.id,
        title: fullMedia.title || fullMedia.name || "Unknown",
        name: fullMedia.name || fullMedia.title || "Unknown",
        poster_path: fullMedia.poster_path || null,
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

    // 4. Fetch Wikipedia URL for voice actors without TMDB ID
    let potentialWikipediaUrl: string | null = null;
    if (!voiceActor.tmdb_id) {
      potentialWikipediaUrl = await fetchPotentialWikipediaUrl(
        voiceActor.firstname,
        voiceActor.lastname,
      );
    }

    return {
      voiceActor: voiceActorWithImages,
      enhancedWorks,
      medias: Array.from(compactMediasMap.values()),
      characterProfilePictures: [],
      potentialWikipediaUrl,
    };
  }

  async getCharacterProfilePictures(
    contentType: "movie" | "tv",
    contentId: number,
    tmdbMedia: any,
  ): Promise<{ characters: any[]; tvdbId: number | null }> {
    const cache = useCache();
    const tvdbClient = new TVDBClient(cache);
    let characterProfilePictures: any[] = [];
    const cacheKey = `tvdb:${contentType}:characters_by_tmdb:${contentId}`;

    try {
      const cachedResult = await cache.get(cacheKey);
      if (cachedResult) {
        if (Array.isArray(cachedResult)) {
          return { characters: cachedResult, tvdbId: null };
        }
        return cachedResult as { characters: any[]; tvdbId: number | null };
      }

      let tvdbId: number | null = null;
      if (tmdbMedia.external_ids?.tvdb_id) {
        tvdbId = tmdbMedia.external_ids.tvdb_id;
      }

      if (!tvdbId && tmdbMedia.external_ids?.wikidata_id) {
        const wikidataId = tmdbMedia.external_ids.wikidata_id;
        try {
          const url = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${wikidataId}&format=json`;
          const response = await fetch(url);
          if (response.ok) {
            const data = await response.json();
            const property = contentType === "movie" ? "P12196" : "P4835";
            const claim = data?.claims?.[property]?.[0];
            if (claim?.mainsnak?.datavalue?.value) {
              tvdbId = parseInt(claim.mainsnak.datavalue.value, 10);
            }
          }
        } catch (e) {
          console.error(`Failed to fetch Wikidata for ${wikidataId}`, e);
        }
      }

      if (!tvdbId) {
        const searchQuery =
          tmdbMedia.title ||
          tmdbMedia.name ||
          tmdbMedia.original_title ||
          tmdbMedia.original_name;

        const searchResults = await tvdbClient.searchSeries(
          searchQuery,
          this.acceptLanguage,
        );

        if (searchResults && searchResults.data) {
          const typeMatchedResults = searchResults.data.filter(
            (item: any) =>
              item.type === contentType ||
              (contentType === "movie" && item.id.startsWith("movie-")) ||
              (contentType === "tv" && item.id.startsWith("series-")),
          );

          const bestMatch =
            typeMatchedResults.find(
              (item: any) =>
                item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.translations?.eng
                  ?.toLowerCase()
                  .includes(searchQuery.toLowerCase()),
            ) || typeMatchedResults[0];

          tvdbId =
            contentType === "movie"
              ? bestMatch?.tvdb_id || bestMatch?.id
              : bestMatch?.id;
        }
      }

      if (tvdbId) {
        let characters: any[] = [];
        if (contentType === "movie") {
          const res = await tvdbClient.getMovieById(
            tvdbId,
            {
              meta: "translations",
              short: false,
            },
            this.acceptLanguage,
          );
          characters = res.data.characters || [];
        } else {
          const res = await tvdbClient.getSeriesById(
            tvdbId,
            {
              meta: "episodes",
              short: false,
            },
            this.acceptLanguage,
          );
          characters = res.data.characters || [];
        }

        if (characters && characters.length > 0) {
          characterProfilePictures = characters
            .filter((character: any) => character.image)
            .map((character: any) => ({
              id: character.id,
              name: cleanCharacterName(character.name),
              image: character.image,
              tvdbPeopleId: character.peopleId,
              movieId: contentType === "movie" ? contentId : undefined,
              seriesId: contentType === "tv" ? contentId : undefined,
            }));
        }
      }

      const resultObj = { characters: characterProfilePictures, tvdbId };
      if (tvdbId !== null) {
        cache.set(cacheKey, resultObj, "SHORT").catch(() => {});
      }

      return resultObj;
    } catch (e) {
      console.error(
        `Error fetching character profile pictures for ${contentType} ${contentId}:`,
        e,
      );
    }

    return { characters: characterProfilePictures, tvdbId: null };
  }

  async getMediaWithVoiceActors(
    contentType: "movie" | "tv",
    contentId: number,
  ) {
    const media = await this.tmdbClient.getMediaWithCredits(
      contentType,
      contentId,
      this.acceptLanguage,
    );

    let collection = null;
    if (contentType === "movie" && media.belongs_to_collection?.id) {
      const collectionData = await this.tmdbClient.getCollection(
        media.belongs_to_collection.id,
      );
      if (collectionData) {
        collection = {
          ...collectionData,
          backdrop_path: collectionData.backdrop_path
            ? `https://image.tmdb.org/t/p/w500${collectionData.backdrop_path}`
            : null,
          poster_path: collectionData.poster_path
            ? `https://image.tmdb.org/t/p/w500${collectionData.poster_path}`
            : null,
          parts: collectionData.parts
            ? collectionData.parts.map((part: any) => ({
                ...part,
                backdrop_path: part.backdrop_path
                  ? `https://image.tmdb.org/t/p/w500${part.backdrop_path}`
                  : null,
                poster_path: part.poster_path
                  ? `https://image.tmdb.org/t/p/w500${part.poster_path}`
                  : null,
              }))
            : [],
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
  ) {
    let media;

    switch (contentType) {
      case "movie":
        media = await this.tmdbClient.getMediaWithCredits(
          "movie",
          id,
          this.acceptLanguage,
        );
        break;
      case "tv":
        media = await this.tmdbClient.getMediaWithCredits(
          "tv",
          id,
          this.acceptLanguage,
        );
        break;
      case "season":
        if (
          seasonNumber === undefined ||
          seasonNumber === null ||
          isNaN(seasonNumber)
        ) {
          throw new Error("seasonNumber required");
        }
        media = await this.tmdbClient.getSeasonWithCredits(
          id,
          seasonNumber,
          this.acceptLanguage,
        );
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
        );
        break;
    }

    const processedMedia = processMedia(media);
    return { media: processedMedia };
  }
}
