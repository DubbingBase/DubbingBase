import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { processMedia } from "../_shared/tmdb-urls.ts";
import { processVoiceActor } from "../_shared/supabase-urls.ts";
import {
  cacheUtils,
  tmdbClient,
  tvdbClient,
  DatabaseClient,
  MediaService,
} from "../_shared/index.ts";
import { Database } from "../_shared/database.types.ts";

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
      const mediaService = new MediaService(dbClient, tmdbClient, ctx);

      // Create promise for external API data using unified cache flows
      const apiDataPromise = mediaService
        .getMediaWithVoiceActors("movie", movieId)
        .then(async (result) => {
          const { characters: characterProfilePictures, tvdbId } =
            await mediaService.getCharacterProfilePictures(
              "movie",
              movieId,
              result.media,
            );
          return {
            movieWithImageUrls: result.media,
            characterProfilePictures,
            collection: result.collection,
            tvdbId,
          };
        })
        .catch((err) => {
          console.error(
            `Failed to fetch TMDB movie ${movieId}, using mock:`,
            err,
          );
          const mockMovie = {
            id: movieId,
            title: "Information indisponible (Timeout)",
            name: "Information indisponible (Timeout)",
            poster_path: null,
            backdrop_path: null,
            overview:
              "Ce contenu n'a pas pu être chargé car les serveurs TMDB sont inaccessibles.",
            credits: { cast: [] },
            release_date: "1970-01-01",
            first_air_date: "1970-01-01",
            external_ids: {},
          };
          return {
            movieWithImageUrls: processMedia(mockMovie),
            characterProfilePictures: [],
            collection: null,
            tvdbId: null,
          };
        });

      // Create promise chain for database queries
      const dbDataPromise = dbClient
        .getDubbingProjects(movieId, "movie")
        .then(async (dubbingProjects) => {
          // Get work IDs for vote fetching
          const workIds = dubbingProjects.flatMap(
            (p: any) => p.works?.map((w: any) => w.id) || [],
          );

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
          return { dubbingProjects, voteData };
        });

      // Run TVDB/TMDB queries and Database queries concurrently
      const [apiData, { dubbingProjects, voteData }] = await Promise.all([
        apiDataPromise,
        dbDataPromise,
      ]);

      const {
        movieWithImageUrls,
        characterProfilePictures,
        collection,
        tvdbId,
      } = apiData;

      const result = {
        movie: movieWithImageUrls,
        characterProfilePictures: characterProfilePictures,
        dubbingProjects: dubbingProjects,
        votes: voteData,
        collection: collection,
        tvdbId: tvdbId,
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
