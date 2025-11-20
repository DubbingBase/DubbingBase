import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase } from "../_shared/database.ts"
import { Database } from "../_shared/database.types.ts"

type VoiceActor = Database['public']['Tables']['voice_actors']['Row']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 405
      }
    )
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

    // Parse request body
    const body = await req.json()
    const { voice_actor_id, updates, targetUserId } = body

    if (!voice_actor_id) {
      return new Response(
        JSON.stringify({ error: 'voice_actor_id is required' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400
        }
      )
    }

    // Determine which user to check permissions for
    const userIdToCheck = targetUserId || user.id

    // Check if the user has permission to update this voice actor
    const { data: linkData, error: linkError } = await supabase
      .from('user_voice_actor_links')
      .select('voice_actor_id')
      .eq('user_id', userIdToCheck)
      .eq('voice_actor_id', voice_actor_id)
      .single()

    if (linkError || !linkData) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized to update this voice actor' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403
        }
      )
    }

    // Prepare update data
    const updateData: any = { ...updates }
    updateData.updated_at = new Date().toISOString()

    // Update voice actor
    const { data: voiceActorData, error: vaError } = await supabase
      .from('voice_actors')
      .update(updateData)
      .eq('id', voice_actor_id)
      .select()
      .single()

    if (vaError) {
      console.error('Error updating voice actor:', vaError)
      return new Response(
        JSON.stringify({ error: 'Failed to update voice actor' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      )
    }

    return new Response(
      JSON.stringify({ profile: voiceActorData }),
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
