import { useSupabaseAdmin } from "../db/client";
import { TMDBClient } from "../api/tmdb";
import { TVDBClient } from "../api/tvdb";
import { processVoiceActor } from "../urls/supabase";
import { processMedia, cleanCharacterName } from "../urls/tmdb";
import { getWorkVotes } from "../db/queries";
import { useCache } from "../index";

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

  async getVoiceActorWithWorkAndMedia(
    voiceActorId: number,
    userId?: string,
    language?: string,
  ) {
    const supabase = useSupabaseAdmin();

    const { data: voiceActor, error: vaError } = await supabase
      .from("voice_actors")
      .select(
        "*, work(id, actor_id, dubbing_projects(content_id, content_type))",
      )
      .eq("id", voiceActorId)
      .single();

    if (vaError || !voiceActor) throw new Error("Voice actor not found");

    const voiceActorWithImages = processVoiceActor(voiceActor);
    const workItems = (voiceActor as any).work || [];
    const workIds = workItems.map((w: any) => w.id);

    const mediaPromises = workItems.map(async (work: any) => {
      const contentId = work.dubbing_projects?.content_id;
      const contentType = work.dubbing_projects?.content_type as "movie" | "tv";

      if (!contentId || !contentType) return null;

      try {
        const tmdbMedia = await this.tmdbClient.getMediaWithCredits(
          contentType,
          contentId,
          language || this.acceptLanguage,
        );

        const { characters, tvdbId } = await this.getCharacterProfilePictures(
          contentType,
          contentId,
          tmdbMedia,
        );

        return {
          media: processMedia(tmdbMedia),
          characterProfilePictures: characters,
          tvdbId,
        };
      } catch (err) {
        console.error(
          `Failed to fetch TMDB ${contentType} ${contentId} for voice actor:`,
          err,
        );
        return {
          media: null,
          characterProfilePictures: [],
          tvdbId: null,
        };
      }
    });

    // 2. Fetch Wikipedia URL for voice actors without TMDB ID
    const wikiPromise = (async () => {
      if (!voiceActor.tmdb_id) {
        return await fetchPotentialWikipediaUrl(
          voiceActor.firstname,
          voiceActor.lastname,
        );
      }
      return null;
    })();

    // 3. Fetch Votes
    const votesPromise = (async () => {
      if (workIds.length > 0) {
        try {
          return await getWorkVotes(workIds, userId);
        } catch (e) {
          console.error("Error fetching votes:", e);
        }
      }
      return {};
    })();

    // Wait for all three tracks in parallel
    const [mediaResultsArray, potentialWikipediaUrl, votes] = await Promise.all(
      [Promise.all(mediaPromises), wikiPromise, votesPromise],
    );

    const validResults = mediaResultsArray
      .filter(Boolean)
      .filter((r) => r.media !== null) as {
      media: any;
      characterProfilePictures: any[];
    }[];

    const medias = validResults.map((r) => r.media);
    const characterProfilePictures = validResults.flatMap(
      (r) => r.characterProfilePictures,
    );

    return {
      voiceActor: voiceActorWithImages,
      medias,
      characterProfilePictures,
      potentialWikipediaUrl: null,
      votes,
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
        await cache.set(cacheKey, resultObj, "SHORT");
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
        if (!seasonNumber) throw new Error("seasonNumber required");
        media = await this.tmdbClient.getSeasonWithCredits(id, seasonNumber);
        break;
      case "episode":
        if (!seasonNumber || !episodeNumber)
          throw new Error("seasonNumber and episodeNumber required");
        media = await this.tmdbClient.getEpisodeWithCredits(
          id,
          seasonNumber,
          episodeNumber,
        );
        break;
    }

    const processedMedia = processMedia(media);
    return { media: processedMedia };
  }
}
