import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase } from "../_shared/database.ts"
import { buildSupabaseImageUrl } from "../_shared/supabase-urls.ts";

interface TopVoiceActorsParams {
  limit?: number;
}

const getTopVoiceActors = async (limit = 10) => {
  try {
    // Use RPC function to get aggregated data directly from database
    const { data, error } = await supabase.rpc('get_top_voice_actors', { limit_param: limit });

    if (error) throw error;

    // Process profile pictures
    const resultsWithImageUrls = data.map(result => ({
      ...result.voice_actor,
      role_count: result.role_count,
      profile_picture: buildSupabaseImageUrl(result.voice_actor.profile_picture, 'voice_actor_profile_pictures', '500')
    }));

    return resultsWithImageUrls || [];
  } catch (error) {
    console.error('Error fetching top voice actors:', error);
    throw error;
  }
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { limit = 10 } = (await req.json()) as TopVoiceActorsParams;

    // Validate limit parameter
    if (typeof limit !== 'number' || limit < 1 || limit > 100) {
      return new Response(
        JSON.stringify({ error: 'Limit must be a number between 1 and 100' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const results = await getTopVoiceActors(limit);

    return new Response(
      JSON.stringify(results),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in top-voice-actors function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});