// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CACHE_KEYS, CACHE_TTL } from "../_shared/cache-utils.ts";
import { TMDBClient } from "../_shared/tmdb.ts";
import { DatabaseClient } from "../_shared/database.ts";
import {
  createErrorResponse,
  createResponse,
  handleOptions,
} from "../_shared/http-utils.ts";
import { buildSupabaseImageUrl } from "../_shared/supabase-urls.ts";
import { buildTmdbImageUrl } from "../_shared/tmdb-urls.ts";
import { cacheUtils } from "../_shared/index.ts";
import { SupabaseContext } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import type {
  WorkPerformance,
  VoiceActorSummary,
  DubbingProject,
  MovieMedia,
  TVMedia,
} from "../_shared/media-types.ts";

async function getActor(
  actorId: number,
  tmdbClient: TMDBClient,
  acceptLanguage?: string,
) {
  const cacheKey = CACHE_KEYS.TMDB_PERSON(actorId);

  // Try cache first
  const cached = await cacheUtils.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Use shared TMDBClient for API calls
    const actorData = await tmdbClient.get(
      `person/${actorId}`,
      {
        append_to_response: "tv_credits,movie_credits,external_ids",
      },
      acceptLanguage,
    );

    // Cache the result
    cacheUtils.set(cacheKey, actorData, "MEDIUM").catch(() => {});

    return actorData;
  } catch (e) {
    console.error("Error fetching actor details:", e);
    return null;
  }
}

// Get voice roles for an actor
async function getVoiceRoles(
  ctx: SupabaseContext<Database>,
  actorId: number,
  tmdbClient: TMDBClient,
  dbClient: DatabaseClient,
  acceptLanguage?: string,
): Promise<WorkPerformance[]> {
  try {
    // Use shared DatabaseClient for database queries
    const workData = await dbClient.getWorkByActor(actorId);

    if (!workData) return [];

    // Count occurrences per voice_actor_id
    const counts: Record<number, number> = {};
    for (const row of workData) {
      if (!row.voice_actor_id) continue;
      counts[row.voice_actor_id] = (counts[row.voice_actor_id] || 0) + 1;
    }

    // Get top 3 most common voice_actor_ids
    const top3 = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id]) => parseInt(id, 10));

    // Map data to output format, add highlight if in top3
    const voiceRoles = (await Promise.all(
      workData.map(async (row) => {
        const { voice_actors, ...work } = row;
        let mediaDetails: MovieMedia | TVMedia | null = null;

        if (
          work.dubbing_projects?.content_id &&
          work.dubbing_projects?.content_type
        ) {
          mediaDetails = await tmdbClient.fetchMediaDetails(
            work.dubbing_projects.content_id,
            work.dubbing_projects.content_type,
            acceptLanguage,
          );
        }

        return {
          id: work.id,
          actor_id: work.actor_id,
          voice_actor_id: work.voice_actor_id,
          highlight: work.voice_actor_id
            ? top3.includes(work.voice_actor_id)
            : false,
          suggestions: work.suggestions,
          status: work.status,
          source_id: work.source_id,
          performance: work.performance,
          dubbing_project_id: work.dubbing_project_id,
          voice_actor: voice_actors
            ? {
                id: voice_actors.id,
                firstname: voice_actors.firstname,
                lastname: voice_actors.lastname,
                profile_picture: buildSupabaseImageUrl(
                  ctx,
                  voice_actors.profile_picture,
                  "voice_actor_profile_pictures",
                  "500",
                ),
                bio: voice_actors.bio,
                nationality: voice_actors.nationality,
                date_of_birth: voice_actors.date_of_birth,
                awards: voice_actors.awards,
                years_active: voice_actors.years_active,
                social_media_links: voice_actors.social_media_links,
                tmdb_id: voice_actors.tmdb_id,
                wikidata_id: voice_actors.wikidata_id,
              }
            : null,
          mediaDetails,
        } as WorkPerformance;
      }),
    )) as WorkPerformance[];

    return voiceRoles;
  } catch (e) {
    console.error("Error fetching voice roles:", e);
    return [];
  }
}

import { withSupabase } from "npm:@supabase/server@^1";

// Main request handler
export default {
  fetch: withSupabase<Database>({ auth: "publishable" }, async (req, ctx) => {
    try {
      const { id } = await req.json();

      if (!id) {
        return createErrorResponse("Missing id parameter", 400);
      }

      const actorId = parseInt(id, 10);
      if (isNaN(actorId)) {
        return createErrorResponse("Invalid id parameter", 400);
      }

      // Initialize shared clients
      const tmdbClient = new TMDBClient(cacheUtils);
      const dbClient = new DatabaseClient(ctx);

      const acceptLanguage = req.headers.get("Accept-Language") || undefined;

      const [actor, voiceRoles] = await Promise.all([
        getActor(actorId, tmdbClient, acceptLanguage),
        getVoiceRoles(ctx, actorId, tmdbClient, dbClient, acceptLanguage),
      ]);

      if (!actor) {
        return createErrorResponse("Actor not found", 404);
      }

      const actorCredits = [
        ...actor.movie_credits.cast.map((x: any) => ({
          ...x,
          media_type: "movie",
        })),
        ...actor.tv_credits.cast.map((x: any) => ({
          ...x,
          media_type: "tv",
        })),
      ].map((castMember: any) => ({
        ...castMember,
        profile_path: buildTmdbImageUrl(castMember.profile_path),
        poster_path: buildTmdbImageUrl(castMember.poster_path),
        backdrop_path: buildTmdbImageUrl(castMember.backdrop_path),
      }));

      console.log("actorCredits", actorCredits);

      const result = {
        actor: {
          ...actor,
          profile_path: buildTmdbImageUrl(actor.profile_path),
          credits: {
            cast: actorCredits,
          },
          voice_roles: voiceRoles,
        },
        voiceActors: voiceRoles,
      };

      return createResponse(result);
    } catch (error) {
      console.error("Error in actor function:", error);
      return createErrorResponse(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
    }
  }),
};
