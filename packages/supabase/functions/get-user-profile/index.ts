import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase } from "../_shared/database.ts"
import { Database } from "../_shared/database.types.ts"

type VoiceActor = Database['public']['Tables']['voice_actors']['Row']
type UserProfile = Database['public']['Tables']['user_profiles']['Row']

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

    console.log('user.id', user.id)

    // Fetch all voice_actor links for the user
    const { data: voiceActorLinks, error: vaLinkError } = await supabase
      .from('user_voice_actor_links')
      .select('voice_actor_id')
      .eq('user_id', user.id)

    if (vaLinkError) {
      console.error('Error fetching voice actor links:', vaLinkError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      )
    }

    // Fetch user profile directly
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

      console.log('userProfile', userProfile)

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user profile' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      )
    }

    // Fetch voice actor profiles
    const voiceActors = []
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

    // Determine primary voice actor (first one for now)
    const primaryVoiceActor = voiceActors.length > 0 ? voiceActors[0] : null

    // Return structured data
    return new Response(
      JSON.stringify({
        user_profile: userProfile,
        voice_actors: voiceActors,
        primary_voice_actor_id: primaryVoiceActor ? primaryVoiceActor.id : null,
        // Backward compatibility: if only one voice actor, include as single profile
        ...(voiceActors.length === 1 ? {
          type: 'voice_actor',
          profile: voiceActors[0]
        } : {})
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
