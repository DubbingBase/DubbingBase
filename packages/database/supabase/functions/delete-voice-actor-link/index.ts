import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase } from "../_shared/database.ts"

console.log('delete-voice-actor-link function started');

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
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
    const requestData = await req.json();
    const { id, targetUserId } = requestData;

    // Validate required fields
    if (!id) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: id' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if user is admin for impersonation
    const isAdmin = user.app_metadata?.role === 'admin' ||
                   user.user_metadata?.role === 'admin' ||
                   user.role === 'admin'

    if (targetUserId && !isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required for impersonation' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403
        }
      )
    }

    // Verify the work exists before attempting to delete
    const { data: existingWork, error: fetchError } = await supabase
      .from('work')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingWork) {
      return new Response(
        JSON.stringify({ error: 'Work not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // If targetUserId is provided, verify the work belongs to the target user's voice actor
    if (targetUserId) {
      const { data: targetUserData, error: targetError } = await supabase.auth.admin.getUserById(targetUserId)
      if (targetError || !targetUserData.user) {
        return new Response(
          JSON.stringify({ error: 'Target user not found' }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 404
          }
        )
      }

      const targetUserVoiceActorId = targetUserData.user.user_metadata?.voice_actor_id
      if (targetUserVoiceActorId !== (existingWork as any).voice_actor_id) {
        return new Response(
          JSON.stringify({ error: 'Target user does not own this work entry' }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 403
          }
        )
      }
    } else {
      // For non-admin users, verify they own this work entry
      const userVoiceActorId = user.user_metadata?.voice_actor_id
      if (!isAdmin && userVoiceActorId !== (existingWork as any).voice_actor_id) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: You can only delete your own work entries' }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 403
          }
        )
      }
    }

    // Delete the work record
    const { error: deleteError } = await supabase
      .from('work')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting work:', deleteError);
      throw deleteError;
    }

    // Return success response
    return new Response(
      JSON.stringify({ success: true, message: 'Voice actor link deleted successfully' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in delete-voice-actor-link:', error);
    const err = error as any
    return new Response(
      JSON.stringify({
        error: err?.message || 'Internal server error',
        details: err?.details || null
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
