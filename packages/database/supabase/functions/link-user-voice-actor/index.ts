import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase } from "../_shared/database.ts"

interface LinkUserVoiceActorRequest {
  user_id: string;
  voice_actor_id: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
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

    // Check if user is admin
    const isAdmin = user.app_metadata?.role === 'admin' ||
                   user.user_metadata?.role === 'admin'
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403
        }
      )
    }

    // Parse request body
    const { user_id, voice_actor_id }: LinkUserVoiceActorRequest = await req.json()

    // Verify voice actor exists
    const { data: voiceActor, error: vaError } = await supabase
      .from('voice_actors')
      .select('id')
      .eq('id', voice_actor_id as any)
      .single()

    if (vaError || !voiceActor) {
      return new Response(
        JSON.stringify({ error: 'Voice actor not found' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404
        }
      )
    }

    // Check if link already exists
    const { data: existingLink, error: checkError } = await supabase
      .from('user_voice_actor_links')
      .select('id')
      .eq('user_id', user_id)
      .eq('voice_actor_id', voice_actor_id)
      .single()

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking existing link:', checkError)
      return new Response(
        JSON.stringify({ error: 'Failed to check existing link' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      )
    }

    if (existingLink) {
      return new Response(
        JSON.stringify({ error: 'User is already linked to this voice actor' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400
        }
      )
    }

    // Insert link in user_voice_actor_links table
    const { error: insertError } = await supabase
      .from('user_voice_actor_links')
      .insert({ user_id, voice_actor_id } as any)

    if (insertError) {
      console.error('Error linking user to voice actor:', insertError)
      return new Response(
        JSON.stringify({ error: 'Failed to link user to voice actor' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User linked to voice actor successfully' }),
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
