import { DatabaseClient } from "./database.ts";
import { ITMDBClient } from "./interfaces.ts";
import { processVoiceActor } from "./supabase-urls.ts";
import { processMedia } from "./tmdb-urls.ts";
import { TVDBClient } from "./tvdb.ts";
import { cacheUtils, wikipediaCache } from "./index.ts";

import { SupabaseContext } from "npm:@supabase/server@^1";
import { Database } from "./database.types.ts";

export class MediaService {
  constructor(
    private databaseClient: DatabaseClient,
    private tmdbClient: ITMDBClient,
    private ctx: SupabaseContext<Database>,
  ) {}

  async getVoiceActorWithWorkAndMedia(voiceActorId: number) {
    const voiceActor = await this.databaseClient.getVoiceActorWithWork(
      voiceActorId,
    );

    console.log("voiceActor fetched:", voiceActor?.id);

    const voiceActorWithImages = processVoiceActor(this.ctx, voiceActor);

    const workItems = voiceActor.work || [];
    const workIds = workItems.map((w) => w.id);

    // 1. Fetch TMDB details and TVDB characters for each work item
    const mediaPromises = workItems.map(async (work) => {
      const contentId = work.dubbing_projects?.content_id;
      const contentType = work.dubbing_projects?.content_type as "movie" | "tv";

      if (!contentId || !contentType) return null;

      try {
        const tmdbMedia = await this.tmdbClient.getMediaWithCredits(
          contentType,
          contentId,
        );

        const characterProfilePictures = await this.getCharacterProfilePictures(
          contentType,
          contentId,
          tmdbMedia,
        );

        return {
          media: processMedia(tmdbMedia),
          characterProfilePictures,
        };
      } catch (err) {
        console.error(
          `Failed to fetch TMDB/TVDB info for ${contentType} ${contentId}:`,
          err,
        );
        return {
          media: {
            id: contentId,
            title: "Information indisponible (Timeout)",
            name: "Information indisponible (Timeout)",
            poster_path: null,
            backdrop_path: null,
            overview:
              "Ce contenu n'a pas pu être chargé car les serveurs TMDB sont inaccessibles.",
            credits: { cast: [] },
            release_date: "1970-01-01",
            first_air_date: "1970-01-01",
          },
          characterProfilePictures: [],
        };
      }
    });

    // 2. Fetch Wikipedia URL
    const wikiPromise = (async () => {
      let potentialWikipediaUrl = null;
      if (!voiceActor.tmdb_id) {
        try {
          const name = `${voiceActor.firstname} ${voiceActor.lastname}`.trim();
          const searchData = await wikipediaCache.searchWikidataEntities(name);

          if (searchData.search && searchData.search.length > 0) {
            const bestMatch = searchData.search[0];
            const entityData = await wikipediaCache.getWikidataEntity(
              bestMatch.id,
            );

            if (entityData.entities[bestMatch.id]?.sitelinks?.frwiki?.title) {
              const title =
                entityData.entities[bestMatch.id].sitelinks.frwiki.title;
              potentialWikipediaUrl = `https://fr.wikipedia.org/wiki/${
                encodeURI(title.replace(/ /g, "_"))
              }`;
            }
          }
        } catch (e) {
          console.error("Failed to fetch potential Wikipedia URL:", e);
        }
      }
      return potentialWikipediaUrl;
    })();

    // 3. Fetch Votes
    const votesPromise = (async () => {
      if (workIds.length > 0) {
        try {
          return await this.databaseClient.getWorkVotes(
            workIds,
            this.ctx.userClaims?.id,
          );
        } catch (e) {
          console.error("Error fetching votes for voice actor works:", e);
        }
      }
      return {};
    })();

    // Wait for all three tracks in parallel
    const [mediaResultsArray, potentialWikipediaUrl, votes] = await Promise.all(
      [
        Promise.all(mediaPromises),
        wikiPromise,
        votesPromise,
      ],
    );

    const validResults = mediaResultsArray.filter(Boolean) as {
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
      potentialWikipediaUrl,
      votes,
    };
  }

  public async getCharacterProfilePictures(
    contentType: "movie" | "tv",
    contentId: number,
    tmdbMedia: any,
  ): Promise<any[]> {
    const tvdbClient = new TVDBClient(cacheUtils);
    let characterProfilePictures: any[] = [];
    const cacheKey = `tvdb:${contentType}:characters_by_tmdb:${contentId}`;

    try {
      // 1. Try Cache First using TMDB ID
      const cachedCharacters = await cacheUtils.get(cacheKey);
      if (cachedCharacters) {
        return cachedCharacters as any[];
      }

      // 2. Fetch from TVDB API
      let tvdbId: number | null = null;
      if (tmdbMedia.external_ids?.tvdb_id) {
        tvdbId = tmdbMedia.external_ids.tvdb_id;
      } else {
        const searchQuery = tmdbMedia.title ||
          tmdbMedia.name ||
          tmdbMedia.original_title ||
          tmdbMedia.original_name;
        if (searchQuery) {
          const searchResults = await tvdbClient.searchSeries(searchQuery);
          if (searchResults.data && searchResults.data.length > 0) {
            const bestMatch = searchResults.data.find(
              (item: any) =>
                item.name
                  ?.toLowerCase()
                  .includes(searchQuery.toLowerCase()) ||
                searchQuery.toLowerCase().includes(item.name?.toLowerCase()),
            ) || searchResults.data[0];
            tvdbId = contentType === "movie"
              ? bestMatch?.tvdb_id || bestMatch?.id
              : bestMatch?.id;
          }
        }
      }

      if (tvdbId) {
        let characters: any[] = [];
        if (contentType === "movie") {
          const res = await tvdbClient.getMovieById(tvdbId, {
            meta: "translations",
            short: false,
          });
          characters = res.data.characters || [];
        } else {
          const res = await tvdbClient.getSeriesById(tvdbId, {
            meta: "episodes",
            short: false,
          });
          characters = res.data.characters || [];
        }

        if (characters && characters.length > 0) {
          characterProfilePictures = characters
            .filter((character: any) => character.image)
            .map((character: any) => ({
              id: character.id,
              name: character.name,
              image: character.image,
              tvdbPeopleId: character.peopleId,
              movieId: contentType === "movie" ? contentId : undefined,
              showId: contentType === "tv" ? contentId : undefined,
            }));
        }
      }

      // 3. Cache the result (even if empty) to prevent redundant API queries
      cacheUtils
        .set(cacheKey, characterProfilePictures, "SHORT")
        .catch(() => {});
    } catch (e) {
      console.error(
        `Error fetching character profile pictures for ${contentType} ${contentId}:`,
        e,
      );
    }

    return characterProfilePictures;
  }

  async getMediaWithVoiceActors(
    contentType: "movie" | "tv",
    contentId: number,
  ) {
    const media = await this.tmdbClient.getMediaWithCredits(
      contentType,
      contentId,
    );

    let collection = null;
    if (contentType === "movie" && media.belongs_to_collection?.id) {
      const collectionData = await this.tmdbClient.getCollection(media.belongs_to_collection.id);
      if (collectionData) {
        collection = {
          ...collectionData,
          backdrop_path: collectionData.backdrop_path ? `https://image.tmdb.org/t/p/w500${collectionData.backdrop_path}` : null,
          poster_path: collectionData.poster_path ? `https://image.tmdb.org/t/p/w500${collectionData.poster_path}` : null,
          parts: collectionData.parts ? collectionData.parts.map((part: any) => ({
            ...part,
            backdrop_path: part.backdrop_path ? `https://image.tmdb.org/t/p/w500${part.backdrop_path}` : null,
            poster_path: part.poster_path ? `https://image.tmdb.org/t/p/w500${part.poster_path}` : null,
          })) : []
        };
      }
    }

    // Process image URLs in the media data
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
        media = await this.tmdbClient.getMediaWithCredits("movie", id);
        break;
      case "tv":
        media = await this.tmdbClient.getMediaWithCredits("tv", id);
        break;
      case "season":
        if (!seasonNumber) {
          throw new Error("seasonNumber required for season contentType");
        }
        media = await this.tmdbClient.getSeasonWithCredits(id, seasonNumber);
        break;
      case "episode":
        if (!seasonNumber || !episodeNumber) {
          throw new Error(
            "seasonNumber and episodeNumber required for episode contentType",
          );
        }
        media = await this.tmdbClient.getEpisodeWithCredits(
          id,
          seasonNumber,
          episodeNumber,
        );
        break;
    }

    // Process image URLs in the media data
    const processedMedia = processMedia(media);

    return { media: processedMedia };
  }
}
