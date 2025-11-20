import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase, supabaseAdmin } from "../_shared/database.ts"

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let body;
  try {
    body = await req.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders });
  }
  const { id } = body;
  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing id' }), { status: 400, headers: corsHeaders });
  }

  const { error } = await supabaseAdmin.from('work').delete().eq('id', id);
  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
