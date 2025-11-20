// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/http-utils.ts"
import { processTrendingMedia } from "../_shared/trending-processor.ts"

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Use the shared trending processor for movies only
  const result = await processTrendingMedia({
    mediaType: 'movie', // Process only movies
    tmdbApiPath: 'https://api.themoviedb.org/3/trending/movie/day',
    prepareFunctionUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/prepare_movie`,
    delayMs: 5000,
    maxItems: 15,
    ntfyTopic: 'Armaldio_DubbingBaseTrendingSummary',
    notificationTitle: 'DubbingBase Trending Movies Report'
  })

  if (!result.ok) {
    return new Response(JSON.stringify({
      ok: false,
      error: result.message,
      summary: result.summary
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }

  return new Response(JSON.stringify({
    ok: true,
    message: result.message,
    summary: result.summary,
    successfulCount: result.successfulCount,
    failedCount: result.failedCount
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
