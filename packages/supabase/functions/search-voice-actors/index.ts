import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase } from "../_shared/database.ts"

interface SearchParams {
  query: string;
  limit?: number;
}

const searchVoiceActors = async (query: string, limit = 10) => {
  try {
    const { data, error } = await supabase
      .from('voice_actors')
      .select('*')
      .or(`firstname.ilike.%${query}%,lastname.ilike.%${query}%`)
      .order('lastname', { ascending: true })
      .limit(limit * 2); // fetch more to allow for full name filtering

    if (error) throw error;

    // Filter by full name in JS
    const lowerQuery = query.toLowerCase();
    const filtered = data.filter(actor => {
      const fullName = `${actor.firstname} ${actor.lastname}`.toLowerCase();
      return (
        actor.firstname.toLowerCase().includes(lowerQuery) ||
        actor.lastname.toLowerCase().includes(lowerQuery) ||
        fullName.includes(lowerQuery)
      );
    });

    // Return up to 'limit' results
    return filtered.slice(0, limit);
  } catch (error) {
    console.error('Error searching voice actors:', error);
    throw error;
  }
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query, limit = 10 } = (await req.json()) as SearchParams;

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query parameter is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const results = await searchVoiceActors(query, limit);

    return new Response(
      JSON.stringify(results),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in search-voice-actors function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
