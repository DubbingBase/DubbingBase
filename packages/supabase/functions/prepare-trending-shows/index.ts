// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/http-utils.ts"
import { processTrendingMedia } from "../_shared/trending-processor.ts"

Deno.serve(async (req) => {
  console.log('req.method', req.method)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Use the shared trending processor for TV shows only
  const result = await processTrendingMedia({
    mediaType: 'tv', // Process only TV shows
    tmdbApiPath: 'https://api.themoviedb.org/3/trending/tv/day',
    prepareFunctionUrl: `${Deno.env.get('SUPABASE_URL')}/functions/v1/show`,
    delayMs: 5000,
    maxItems: 15,
    ntfyTopic: 'Armaldio_DubbingBaseTrendingSummary',
    notificationTitle: 'DubbingBase Trending Shows Report'
  })

  if (!result.ok) {
    console.error('Trending shows processing failed:', result.message)
    return new Response(JSON.stringify({
      ok: false,
      error: result.message,
      summary: result.summary
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }

  console.log('Trending shows processing completed successfully:', result.message)
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
