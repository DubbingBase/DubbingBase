// supabase/functions/update_user_role/index.ts
import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase, supabaseAdmin } from "../_shared/database.ts"

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
      }

  const body = await req.json()
  const { userId, role } = body
  if (!userId || !role) {
    return new Response('Missing userId or role', { status: 400, headers: corsHeaders })
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    app_metadata: { role },
  })
  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500, headers: corsHeaders })
  }
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
})
