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

async function getActor(actorId: number, tmdbClient: TMDBClient) {
  const cacheKey = CACHE_KEYS.TMDB_PERSON(actorId);

  // Try cache first
  const cached = await cacheUtils.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Use shared TMDBClient for API calls
    const actorData = await tmdbClient.get(`person/${actorId}`, {
      append_to_response: "tv_credits,movie_credits,external_ids",
    });

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
): Promise<any[]> {
  try {
    // TODO: rework

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
        let mediaDetails = null;

        if (
          work.dubbing_projects?.content_id &&
          work.dubbing_projects?.content_type
        ) {
          mediaDetails = await tmdbClient.fetchMediaDetails(
            work.dubbing_projects.content_id,
            work.dubbing_projects.content_type,
          );
        }

        return {
          ...work,
          highlight: work.voice_actor_id
            ? top3.includes(work.voice_actor_id)
            : false,
          voice_actors: voice_actors
            ? [
              {
                ...voice_actors,
                profile_picture: buildSupabaseImageUrl(
                  ctx,
                  voice_actors.profile_picture,
                  "voice_actor_profile_pictures",
                  "500",
                ),
              },
            ]
            : [],
          mediaDetails: mediaDetails
            ? {
              id: mediaDetails.id,
              title: mediaDetails.title || mediaDetails.name,
              original_title: mediaDetails.original_title ||
                mediaDetails.original_name,
              poster_path: buildTmdbImageUrl(mediaDetails.poster_path),
              release_date: mediaDetails.release_date ||
                mediaDetails.first_air_date,
              media_type: work.dubbing_projects?.content_type || "",
              overview: mediaDetails.overview,
            }
            : null,
        };
      }),
    )) as any[];

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

      const [actor, voiceRoles] = await Promise.all([
        getActor(actorId, tmdbClient),
        getVoiceRoles(ctx, actorId, tmdbClient, dbClient),
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
