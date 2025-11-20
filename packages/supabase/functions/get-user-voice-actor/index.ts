import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase } from "../_shared/database.ts"
import { Database } from "../_shared/database.types.ts"
import { Movie, Serie } from "../_shared/types.ts";

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

    // Check if request body contains targetUserId for admin impersonation
    let voiceActorIds: number[] = [];

    if (req.method === 'POST') {
      const body = await req.json();
      console.log('body', body)
      const targetUserId = body?.targetUserId;
      const providedVoiceActorId = body?.voiceActorId;

      if (providedVoiceActorId) {
        voiceActorIds = [providedVoiceActorId];
      } else if (targetUserId) {
        // Admin impersonation logic
        const isAdmin = user.app_metadata?.role === 'admin' ||
                        user.user_metadata?.role === 'admin' ||
                        user.role === 'admin';

        if (!isAdmin) {
          return new Response(
            JSON.stringify({ error: 'Unauthorized: Admin access required' }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 403
            }
          );
        }

        const { data: targetUserData, error: targetError } = await supabase.auth.admin.getUserById(targetUserId);
        if (targetError || !targetUserData.user) {
          return new Response(
            JSON.stringify({ error: 'Target user not found' }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 404
            }
          );
        }

        // Query user_voice_actor_links for target user
        const { data: targetLinkData, error: targetLinkError } = await supabase
          .from('user_voice_actor_links')
          .select('voice_actor_id')
          .eq('user_id', targetUserId)

        if (targetLinkError) {
          console.error('Error fetching target user voice actor links:', targetLinkError)
          return new Response(
            JSON.stringify({ error: 'Failed to fetch target user voice actors' }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 500
            }
          )
        }
        voiceActorIds = targetLinkData?.map(link => link.voice_actor_id) || [];
      }
    }

    if (voiceActorIds.length === 0) {
      // Fallback to the authenticated user's own voice_actor_ids from user_voice_actor_links
      const { data: userLinkData, error: userLinkError } = await supabase
        .from('user_voice_actor_links')
        .select('voice_actor_id')
        .eq('user_id', user.id)

      if (userLinkError) {
        console.error('Error fetching user voice actor links:', userLinkError)
        return new Response(
          JSON.stringify({ error: 'Failed to fetch user voice actors' }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 500
          }
        )
      }
      voiceActorIds = userLinkData?.map(link => link.voice_actor_id) || [];
    }

    if (voiceActorIds.length === 0) {
      return new Response(
        JSON.stringify({ voiceActors: [] }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    // Fetch voice actors data with work entries
    const results: { voiceActor: VoiceActor; medias: any[] }[] = [];

    for (const vaId of voiceActorIds) {
      const { data: voiceActorData, error: vaError } = await supabase
        .from('voice_actors')
        .select(`*,
          work (
            *
          )`)
        .eq('id', vaId)
        .single()

      if (vaError) {
        console.error('Error fetching voice actor:', vaError)
        continue; // Skip this one
      }

      const result = {
        voiceActor: voiceActorData as unknown as VoiceActor,
        medias: []
      }

      const workEntries = (voiceActorData as any).work || []
      const populatedWorkEntries = []

      for (const work of workEntries) {
        try {
          const response = await fetch(`https://api.themoviedb.org/3/${work.content_type}/${work.content_id}?append_to_response=credits,external_ids&language=fr-FR`, {
            headers: {
              "Content-Type": "application/json",
              'Authorization': `Bearer ${Deno.env.get('TMDB_API_KEY')}`,
              'Accept': 'application/json',
            },
          })

          const tmdbMedia = await response.json() as Movie | Serie

          // Find character name from TMDB credits using actor_id
          let tmdbCharacterName: string | undefined;
          if (work.actor_id && (tmdbMedia as any).credits?.cast) {
            const castMember = (tmdbMedia as any).credits.cast.find((c: any) => c.id === work.actor_id);
            tmdbCharacterName = castMember?.character;
          }

          // Combine unique names from TMDB (character) and our DB (performance)
          const allCharacterNames = new Set<string>();
          if (tmdbCharacterName) {
              tmdbCharacterName.split('/').forEach(name => allCharacterNames.add(name.trim()));
          }
          const finalCharacterName = Array.from(allCharacterNames).join(' / ');

          populatedWorkEntries.push({
            ...work,
            character_name: finalCharacterName,
            media: {
              ...tmdbMedia,
              media_type: work.content_type as "movie" | "tv"
            }
          })
        } catch (e) {
          console.error('Error fetching media:', e)
        }
      }

      result.medias = populatedWorkEntries;
      results.push(result);
    }

    return new Response(
      JSON.stringify({ voiceActors: results }),
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
