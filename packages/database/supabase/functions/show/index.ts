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
import type {
  TVMedia,
  TVDetailResponse,
  DubbingProject,
  WorkPerformance,
  VoiceActorSummary,
  CharacterProfilePicture,
  VoteData,
  Season,
  Cast,
  Genre,
} from "../_shared/media-types.ts";

// Transform TMDB show to lean TVMedia
function transformShowToMedia(show: any): TVMedia {
  const processed = processMedia(show);
  return {
    id: processed.id,
    title: processed.name,
    overview: processed.overview,
    poster_path: processed.poster_path,
    backdrop_path: processed.backdrop_path,
    vote_average: processed.vote_average,
    vote_count: processed.vote_count,
    genres:
      processed.genres?.map((g: Genre) => ({ id: g.id, name: g.name })) || [],
    credits: {
      cast:
        processed.credits?.cast?.map((c: any) => ({
          id: c.id,
          name: c.name,
          character: c.character,
          profile_path: c.profile_path,
        })) || [],
    },
    external_ids: processed.external_ids || {
      imdb_id: null,
      wikidata_id: null,
    },
    media_type: "tv",
    first_air_date: processed.first_air_date,
    seasons:
      processed.seasons?.map((s: any) => ({
        id: s.id,
        season_number: s.season_number,
        episode_count: s.episode_count,
        name: s.name,
        overview: s.overview,
        poster_path: s.poster_path,
        air_date: s.air_date,
        vote_average: s.vote_average,
      })) || [],
    status: processed.status,
    aggregateCredits: processed.aggregate_credits
      ? {
          cast:
            processed.aggregate_credits.cast?.map((c: any) => ({
              id: c.id,
              name: c.name,
              character: c.character,
              profile_path: c.profile_path,
            })) || [],
        }
      : null,
  };
}

function transformDubbingProjects(projects: any[], ctx: any): DubbingProject[] {
  return projects.map((p) => ({
    id: p.id,
    content_id: p.content_id,
    content_type: p.content_type,
    language: p.language,
    studio_id: p.studio_id,
    studio_data: p.studio_data
      ? {
          id: p.studio_data.id,
          name: p.studio_data.name,
          logo: p.studio_data.logo,
          website: p.studio_data.website,
        }
      : null,
    status: p.status,
    works:
      p.works?.map((w: any) => ({
        id: w.id,
        actor_id: w.actor_id,
        voice_actor_id: w.voice_actor_id,
        highlight: w.highlight,
        suggestions: w.suggestions,
        status: w.status,
        source_id: w.source_id,
        performance: w.performance,
        dubbing_project_id: w.dubbing_project_id,
        voice_actor: w.voice_actor
          ? {
              id: w.voice_actor.id,
              firstname: w.voice_actor.firstname,
              lastname: w.voice_actor.lastname,
              profile_picture: w.voice_actor.profile_picture,
              bio: w.voice_actor.bio,
              nationality: w.voice_actor.nationality,
              date_of_birth: w.voice_actor.date_of_birth,
              awards: w.voice_actor.awards,
              years_active: w.voice_actor.years_active,
              social_media_links: w.voice_actor.social_media_links,
              tmdb_id: w.voice_actor.tmdb_id,
              wikidata_id: w.voice_actor.wikidata_id,
            }
          : null,
      })) || [],
    crew:
      p.crew?.map((c: any) => ({
        id: c.id,
        name: c.name,
        job: c.job,
        department: c.department,
        profile_path: c.profile_path,
      })) || [],
  }));
}

function transformVotes(votes: Record<number, any>): Record<number, VoteData> {
  const result: Record<number, VoteData> = {};
  for (const [key, value] of Object.entries(votes)) {
    result[Number(key)] = {
      up_count: value.up_count ?? 0,
      down_count: value.down_count ?? 0,
      user_vote: value.user_vote ?? null,
    };
  }
  return result;
}

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

      // Transform to new lean types
      const media = transformShowToMedia(serieWithImageUrls);
      const transformedProjects = transformDubbingProjects(
        dubbingProjects,
        ctx,
      );
      const transformedVotes = transformVotes(voteData);
      const transformedAggregateCredits = aggregateCredits
        ? {
            cast:
              aggregateCredits.cast?.map((c: any) => ({
                id: c.id,
                name: c.name,
                character: c.character,
                profile_path: c.profile_path,
              })) || [],
          }
        : null;
      const transformedCharacterPictures: CharacterProfilePicture[] =
        characterProfilePictures?.map((cp: any) => ({
          id: cp.id,
          name: cp.name,
          image: cp.image,
          tvdbPeopleId: cp.tvdbPeopleId,
          seriesId: cp.showId,
        })) || [];

      const result: TVDetailResponse = {
        media,
        dubbingProjects: transformedProjects,
        votes: transformedVotes,
        characterProfilePictures: transformedCharacterPictures,
        aggregateCredits: transformedAggregateCredits,
        tvdbId,
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
