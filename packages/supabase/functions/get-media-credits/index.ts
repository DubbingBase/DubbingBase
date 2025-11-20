import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/http-utils.ts"

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const { media_type, media_id } = await req.json()

  if (!media_type || !media_id) {
    return new Response(
      JSON.stringify({ error: 'media_type and media_id are required' }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400
      }
    )
  }

  try {
    const response = await fetch(`https://api.themoviedb.org/3/${media_type}/${media_id}/credits?language=fr-FR`, {
      headers: {
        "Content-Type": "application/json",
        'Authorization': `Bearer ${Deno.env.get('TMDB_API_KEY')}`,
        'Accept': 'application/json',
      },
    })

    const data = await response.json()

    return new Response(
      JSON.stringify(data),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch credits' }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    )
  }
})
