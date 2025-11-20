import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase, supabaseAdmin } from "../_shared/database.ts"

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
      }

  const body = await req.json();
  console.log("body", body);
  const { keepId, ids } = body;
  if (!keepId || !ids || !Array.isArray(ids) || ids.length === 0) {
    return new Response(JSON.stringify({ error: 'Invalid input' }), { status: 400 });
  }

  // Remove keepId from ids if present
  const otherIds = ids.filter((id: number) => id !== keepId);
  console.log("otherIds", otherIds);
  if (otherIds.length === 0) {
    return new Response(JSON.stringify({ success: true, message: 'No duplicates to merge.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // 1. Update all 'work' records to point to keepId
  const { error: updateError } = await supabaseAdmin.from('work')
    .update({ voice_actor_id: keepId })
    .in('voice_actor_id', otherIds);
  if (updateError) {
    return new Response(JSON.stringify({ error: updateError }), { status: 500, headers: corsHeaders });
  }

  // 2. Delete the duplicate voice_actors
  const { error: deleteError } = await supabaseAdmin.from('voice_actors')
    .delete()
    .in('id', otherIds);
  if (deleteError) {
    return new Response(JSON.stringify({ error: deleteError }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
