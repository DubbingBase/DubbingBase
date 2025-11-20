import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase } from "../_shared/database.ts"
import { Database } from "../_shared/database.types.ts"

type VoiceActor = Database['public']['Tables']['voice_actors']['Row']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get the authenticated user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401
        }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401
        }
      )
    }

    // Parse query parameters for pagination
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    // Fetch voice_actor links for the user with pagination
    const { data: voiceActorLinks, error: vaLinkError, count } = await supabase
      .from('user_voice_actor_links')
      .select('voice_actor_id', { count: 'exact' })
      .eq('user_id', user.id)
      .range(offset, offset + limit - 1)

    if (vaLinkError) {
      console.error('Error fetching voice actor links:', vaLinkError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch voice actors' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      )
    }

    // Fetch voice actor profiles
    const voiceActors: VoiceActor[] = []
    if (voiceActorLinks && voiceActorLinks.length > 0) {
      for (const link of voiceActorLinks) {
        const { data: voiceActorData, error: vaError } = await supabase
          .from('voice_actors')
          .select('*')
          .eq('id', link.voice_actor_id)
          .single()

        if (vaError) {
          console.error('Error fetching voice actor:', vaError)
          continue // Skip this one
        }

        voiceActors.push(voiceActorData)
      }
    }

    // Calculate pagination metadata
    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPrevPage = page > 1

    return new Response(
      JSON.stringify({
        voice_actors: voiceActors,
        pagination: {
          page,
          limit,
          total_count: totalCount,
          total_pages: totalPages,
          has_next_page: hasNextPage,
          has_prev_page: hasPrevPage
        },
        metadata: {
          primary_voice_actor_id: voiceActors.length > 0 ? voiceActors[0].id : null
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500
      }
    )
  }
})
