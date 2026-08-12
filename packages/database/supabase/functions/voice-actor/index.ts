// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createResponse, createErrorResponse } from "../_shared/http-utils.ts";

import { withSupabase } from "npm:@supabase/server@^1";

import { DatabaseClient, MediaService, tmdbClient } from "../_shared/index.ts";
import { Database } from "../_shared/database.types.ts";
import type {
  VoiceActorSummary,
  WorkPerformance,
  DubbingProject,
  MovieMedia,
  TVMedia,
  GameMedia,
  CharacterProfilePicture,
  VoteData,
} from "../_shared/media-types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "publishable" }, async (req, ctx) => {
    try {
      const { id } = await req.json();

      if (!id) {
        return createErrorResponse("Missing id parameter", 400);
      }

      console.log("Fetching voice actor with id:", id);

      const dbClient = new DatabaseClient(ctx);
      const acceptLanguage = req.headers.get("Accept-Language") || undefined;
      const mediaService = new MediaService(
        dbClient,
        tmdbClient,
        ctx,
        acceptLanguage,
      );
      const result = await mediaService.getVoiceActorWithWorkAndMedia(id);

      return createResponse(result);
    } catch (error) {
      console.error("Error fetching voice actor:", error);
      return createErrorResponse("Failed to fetch voice actor data");
    }
  }),
};
