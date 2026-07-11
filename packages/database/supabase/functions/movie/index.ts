import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { processMedia } from "../_shared/tmdb-urls.ts";
import { processVoiceActor } from "../_shared/supabase-urls.ts";
import {
  cacheUtils,
  tmdbClient,
  tvdbClient,
  DatabaseClient,
} from "../_shared/index.ts";
import { Database } from "../_shared/database.types.ts";

/**
 * Helper to fetch TMDB movie details and TMDB/TVDB character images.
 */
async function fetchMovieAndTVDBData(movieId: number) {
  // Try cache first for movie data, fallback to API
  let movie: any = await cacheUtils.get(`tmdb:movie:${movieId}`);
  if (!movie) {
    console.log(`Cache miss for TMDB movie ${movieId}, fetching from API`);
    movie = await tmdbClient.get(`movie/${movieId}`, {
      append_to_response: "credits,external_ids",
    });
    // Cache the result for future requests
    cacheUtils
      .set(`tmdb:movie:${movieId}`, movie, "MEDIUM")
      .catch((err) => console.error("Failed to cache TMDB movie data:", err));
  } else {
    console.log(`Cache hit for TMDB movie ${movieId}`);
  }
  const movieWithImageUrls = processMedia(movie);

  let characterProfilePictures: any[] = [];
  try {
    // Try to find TheTVDB series ID from TMDB external_ids first
    let tvdbSeriesId: number | null = null;

    if (movie.external_ids?.tvdb_id) {
      tvdbSeriesId = movie.external_ids.tvdb_id;
      console.log(
        `Found TVDB series ID from TMDB external_ids: ${tvdbSeriesId}`,
      );
    } else {
      // Fallback to search if no direct external_id
      console.log("No direct TVDB external_id found, searching...");
      const searchQuery = movie.title || movie.original_title;
      if (searchQuery) {
        const searchResults = await tvdbClient.searchSeries(searchQuery);
        if (searchResults.data && searchResults.data.length > 0) {
          // Find the best match (could be improved with more sophisticated matching)
          const bestMatch =
            searchResults.data.find(
              (series: any) =>
                series.name
                  ?.toLowerCase()
                  .includes(searchQuery.toLowerCase()) ||
                searchQuery.toLowerCase().includes(series.name?.toLowerCase()),
            ) || searchResults.data[0];
          tvdbSeriesId = bestMatch?.tvdb_id;
          console.log(`Found TVDB series ID from search: ${tvdbSeriesId}`);
        }
      }
    }

    // Get character profile pictures if we found a TVDB series ID
    if (tvdbSeriesId) {
      const cacheKey = `tvdb:movie:characters:${tvdbSeriesId}`;
      const cachedCharacters = await cacheUtils.get(cacheKey);

      if (cachedCharacters) {
        console.log(`Cache hit for TVDB movie characters ${tvdbSeriesId}`);
        characterProfilePictures = cachedCharacters as any[];
      } else {
        console.log(
          `Cache miss for TVDB movie characters ${tvdbSeriesId}, fetching from API`,
        );
        const charactersResponse = await tvdbClient.getMovieById(tvdbSeriesId, {
          meta: "translations",
          short: false,
        });
        const characters = charactersResponse.data.characters;
        if (characters && characters.length > 0) {
          characterProfilePictures = characters
            .filter((character: any) => character.image)
            .map((character: any) => ({
              id: character.id,
              name: character.name,
              image: character.image,
              movieId: movieId,
            }));
          console.log(
            `Found ${characterProfilePictures.length} character profile pictures`,
          );

          // Cache the character data with shorter TTL since character data can be more dynamic
          cacheUtils
            .set(cacheKey, characterProfilePictures, "SHORT")
            .catch((err) =>
              console.error("Failed to cache TVDB movie character data:", err),
            );
        }
      }
    } else {
      console.log(
        "No TVDB series ID found, skipping character profile pictures",
      );
    }
  } catch (tvdbError) {
    console.error(
      "Error fetching character profile pictures from TVDB:",
      tvdbError,
    );
  }

  return { movieWithImageUrls, characterProfilePictures };
}

export default {
  fetch: withSupabase<Database>({ auth: "publishable:*" }, async (req, ctx) => {
    try {
      const { id } = await req.json();

      if (!id) {
        return Response.json(
          { error: "Missing id parameter" },
          { status: 400 },
        );
      }

      const movieId = parseInt(id, 10);
      if (isNaN(movieId)) {
        return Response.json(
          { error: "Invalid id parameter" },
          { status: 400 },
        );
      }

      console.log("CTX KEYS:", Object.keys(ctx));
      console.log("CTX.SUPABASE:", !!ctx.supabase);
      console.log("CTX.SUPABASEADMIN:", !!ctx.supabaseAdmin);

      // Use shared DatabaseClient for database queries, initialized with context clients
      const dbClient = new DatabaseClient(ctx);

      // Run TVDB/TMDB queries and Database queries concurrently
      const [apiData, voiceActors] = await Promise.all([
        fetchMovieAndTVDBData(movieId),
        dbClient.getWorkWithVoiceActors(movieId),
      ]);

      const { movieWithImageUrls, characterProfilePictures } = apiData;

      // Get work IDs for vote fetching
      const workIds = voiceActors.map((va) => va.id);

      // Get vote data if there are work entries. Use ctx.userClaims directly for authentication check.
      let voteData: Record<
        number,
        { up_count: number; down_count: number; user_vote: string | null }
      > = {};
      if (workIds.length > 0) {
        try {
          const user = ctx.userClaims;
          if (user) {
            voteData = await dbClient.getWorkVotes(workIds, user.id);
          } else {
            voteData = await dbClient.getWorkVotes(workIds);
          }
        } catch (voteError) {
          console.error("Error fetching vote data:", voteError);
        }
      }

      const voiceActorsWithImages = voiceActors.map((va) => ({
        ...va,
        voiceActorDetails: processVoiceActor(ctx, va.voiceActorDetails),
        up_votes: voteData[va.id]?.up_count || 0,
        down_votes: voteData[va.id]?.down_count || 0,
        user_vote: voteData[va.id]?.user_vote || null,
      }));

      const result = {
        movie: movieWithImageUrls,
        voiceActors: voiceActorsWithImages,
        characterProfilePictures: characterProfilePictures,
      };

      return Response.json(result);
    } catch (error) {
      console.error("Error in movie function:", error);
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "An unknown error occurred",
        },
        { status: 500 },
      );
    }
  }),
};
