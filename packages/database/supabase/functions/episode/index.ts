// Supabase Edge Function: episode
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createResponse, createErrorResponse, handleOptions } from "../_shared/http-utils.ts"
import { TMDBClient } from "../_shared/tmdb.ts"
import { cacheUtils } from "../_shared/index.ts"


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleOptions()
  }

  try {
    const { id, season_number, episode_number } = await req.json()

    if (!id || season_number === undefined || episode_number === undefined) {
      return createErrorResponse('Missing id, season_number or episode_number', 400)
    }

    console.log('Fetching episode:', { id, season_number, episode_number })

    const tmdbClient = new TMDBClient(cacheUtils)
    const result = await tmdbClient.getMediaWithVoiceActors('episode', id, season_number, episode_number)

    return createResponse({
      episode: result.media,
      db_voice_actors: result.voice_actors
    })
  } catch (error) {
    console.error('Error fetching episode:', error)
    return createErrorResponse('Failed to fetch episode data')
  }
});
