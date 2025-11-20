import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase, supabaseUser } from "../_shared/database.ts"
import { Database } from "../_shared/database.types.ts"

type UserProfile = Database['public']['Tables']['user_profiles']['Row']

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

    const supabaseClient = supabaseUser(authHeader)
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

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
    const { bio, date_of_birth, nationality } = body

    // Insert user profile
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: user.id,
        bio: bio || null,
        date_of_birth: date_of_birth || null
      })
      .select()
      .single()

    if (profileError) {
      console.error('Error creating user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to create user profile' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500
        }
      )
    }


    return new Response(
      JSON.stringify({ profile: profileData }),
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
