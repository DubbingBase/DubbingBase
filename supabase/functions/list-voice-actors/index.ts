import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase } from "../_shared/database.ts"

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body to get optional query parameter
    const requestBody = await req.json().catch(() => ({}));
    const query = requestBody.query;

    let queryBuilder = supabase
      .from('voice_actors')
      .select('*');

    // Apply filtering if query is provided
    if (query && typeof query === 'string' && query.trim()) {
      // Use ilike with concatenated firstname and lastname for case-insensitive search
      const searchQuery = query.trim();
      queryBuilder = queryBuilder.or(`firstname.ilike.%${searchQuery}%,lastname.ilike.%${searchQuery}%,firstname.ilike.%${searchQuery.split(' ')[0]}%`);
    }

    const { data, error } = await queryBuilder
      .order('lastname', { ascending: true })
      .order('firstname', { ascending: true });

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ voice_actors: data }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    )
  }
})
