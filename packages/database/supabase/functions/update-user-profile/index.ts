import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase } from "../_shared/database.ts"
import { Database } from "../_shared/database.types.ts"

type UserProfile = Database['public']['Tables']['user_profiles']['Row']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
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
    const { bio, date_of_birth, nationality } = body

    // Update user profile directly
    const updateData: any = {}
    if (bio !== undefined) updateData.bio = bio
    if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth
    if (nationality !== undefined) updateData.nationality = nationality
    updateData.updated_at = new Date().toISOString()
    updateData.user_id = user.id

    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .upsert(updateData, { onConflict: 'user_id' })
      .select()
      .single()

    if (profileError) {
      console.error('Error updating user profile:', profileError)
      return new Response(
        JSON.stringify({ error: 'Failed to update user profile' }),
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
