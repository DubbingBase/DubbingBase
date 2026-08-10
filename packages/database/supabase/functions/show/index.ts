import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { processMedia } from "../_shared/tmdb-urls.ts";
import { processVoiceActor } from "../_shared/supabase-urls.ts";
import {
  CACHE_KEYS,
  cacheUtils,
  DatabaseClient,
  getParams,
  MediaService,
  tmdbClient,
  tvdbClient,
} from "../_shared/index.ts";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "publishable" }, async (req, ctx) => {
    try {
      const { id } = await getParams(req);

      if (!id) {
        return Response.json(
          { error: "Missing id parameter" },
          { status: 400 },
        );
      }

      const showId = parseInt(id, 10);
      if (isNaN(showId)) {
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
      const acceptLanguage = req.headers.get("Accept-Language") || undefined;
      const mediaService = new MediaService(
        dbClient,
        tmdbClient,
        ctx,
        acceptLanguage,
      );

      // Fetch aggregate credits concurrently
      const aggregateCreditsPromise = (async () => {
        const cacheKey = CACHE_KEYS.TMDB_TV(
          Number(showId),
          "aggregate_credits",
        );
        const cachedCredits = await cacheUtils.get(cacheKey);
        if (cachedCredits) {
          console.log(`Cache hit for TMDB TV aggregate credits ${showId}`);
          return cachedCredits;
        } else {
          console.log(
            `Cache miss for TMDB TV aggregate credits ${showId}, fetching from API`,
          );
          try {
            const credits = await tmdbClient.get(
              `tv/${showId}/aggregate_credits`,
            );
            await cacheUtils.set(cacheKey, credits, "MEDIUM");
            return credits;
          } catch (err) {
            console.error(`Failed to fetch TMDB show credits ${showId}:`, err);
            return { cast: [] };
          }
        }
      })();

      // Create promise for external API data using unified cache flows
      const apiDataPromise = mediaService
        .getMediaWithVoiceActors("tv", showId)
        .then(async (result) => {
          let { characters: characterProfilePictures, tvdbId } =
            await mediaService.getCharacterProfilePictures(
              "tv",
              showId,
              result.media,
            );

          let aggregateCredits =
            result.media.aggregate_credits || (await aggregateCreditsPromise);

          // Removed backend matching logic as the frontend handles image matching reactively

          const creditsWithImages = processMedia({ credits: aggregateCredits });
          return {
            serieWithImageUrls: result.media,
            aggregateCredits: creditsWithImages.credits,
            characterProfilePictures,
            tvdbId,
          };
        })
        .catch((err) => {
          console.error(
            `Failed to fetch TMDB show ${showId}, using mock:`,
            err,
          );
          const mockSerie = {
            id: showId,
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
            serieWithImageUrls: processMedia(mockSerie),
            aggregateCredits: { cast: [] },
            characterProfilePictures: [],
            tvdbId: null,
          };
        });

      // Create promise chain for database queries
      const dbDataPromise = dbClient
        .getDubbingProjects(showId, "tv")
        .then(async (dubbingProjects) => {
          const workIds = dubbingProjects.flatMap(
            (p: any) => p.works?.map((w: any) => w.id) || [],
          );

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
        serieWithImageUrls,
        aggregateCredits,
        characterProfilePictures,
        tvdbId,
      } = apiData;

      // Lazy Wikipedia Queue Enqueue
      const isProcessed = dubbingProjects.length > 0;
      const hasWiki = !!serieWithImageUrls?.external_ids?.wikidata_id;

      if (!isProcessed && hasWiki) {
        // Enqueue it lazily in the background
        void (async () => {
          try {
            await ctx.supabaseAdmin.rpc("enqueue_media_fetch", {
              p_media_type: "tv",
              p_tmdb_id: showId,
              p_season_number: undefined,
              p_episode_number: undefined,
            });
          } catch (err) {
            console.error("Failed to lazily enqueue show:", err);
          }
        })();
      }

      const result = {
        serie: serieWithImageUrls,
        aggregateCredits: aggregateCredits,
        characterProfilePictures: characterProfilePictures,
        dubbingProjects: dubbingProjects,
        votes: voteData,
        tvdbId: tvdbId,
      };

      return Response.json(result);
    } catch (error) {
      console.error("Error in show function:", error);
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
