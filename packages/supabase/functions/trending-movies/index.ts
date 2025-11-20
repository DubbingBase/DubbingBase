// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/http-utils.ts"
import { buildTmdbImageUrl } from "../_shared/tmdb-urls.ts";

Deno.serve(async (req) => {
  console.log('req.method', req.method)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const response = await fetch("https://api.themoviedb.org/3/trending/movie/day?language=fr-FR", {
    headers: {
      "Content-Type": "application/json",
      'Authorization': `Bearer ${Deno.env.get('TMDB_API_KEY')}`,
      'Accept': 'application/json',
    },
  })

  const json = await response.json()
  const trendingMovies = {
    ...json,
    results: json.results.map((result: any) => ({
      ...result,
      backdrop_path: buildTmdbImageUrl(result.backdrop_path, 'w780'),
      poster_path: buildTmdbImageUrl(result.poster_path, 'w342'),
    }))
  }

  return new Response(
    JSON.stringify(trendingMovies),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    },
  )
})
