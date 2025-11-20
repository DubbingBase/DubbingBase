// Supabase Edge Function: season
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createResponse, createErrorResponse, handleOptions } from "../_shared/http-utils.ts"
import { TMDBClient } from "../_shared/tmdb.ts";
import { DatabaseClient } from "../_shared/database.ts";
import { MediaService } from "../_shared/media-service.ts";
import { cacheUtils } from "../_shared/index.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  try {
    const { id, season_number } = await req.json()

    if (!id || season_number === undefined) {
      return createErrorResponse('Missing id or season_number', 400)
    }

    console.log('Fetching season:', { id, season_number })

    const tmdbClient = new TMDBClient(cacheUtils)
    const databaseClient = new DatabaseClient()
    const mediaService = new MediaService(databaseClient, tmdbClient)

    const result = await mediaService.getMediaWithVoiceActorsExtended('season', id, season_number)

    return createResponse({
      season: result.media,
      db_voice_actors: result.voice_actors
    })
  } catch (error) {
    console.error('Error fetching season:', error)
    return createErrorResponse('Failed to fetch season data')
  }
})
