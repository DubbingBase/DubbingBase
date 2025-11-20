import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase } from "../_shared/database.ts"
import { buildSupabaseImageUrl } from "../_shared/supabase-urls.ts";
interface RecentVoiceActorsParams {
  limit?: number;
}

const getRecentVoiceActors = async (limit = 10) => {
  try {
    const { data, error } = await supabase
      .from('voice_actors')
      .select('*')
      .order('id', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Error fetching recent voice actors:', error);
    throw error;
  }
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { limit = 10 } = (await req.json()) as RecentVoiceActorsParams;

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

    const results = await getRecentVoiceActors(limit);
    const resultsWithImageUrls = results.map(result => ({
      ...result,
      profile_picture: buildSupabaseImageUrl(result.profile_picture, 'voice_actor_profile_pictures', '500')
    }));

    return new Response(
      JSON.stringify(resultsWithImageUrls),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in recent-voice-actors function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
