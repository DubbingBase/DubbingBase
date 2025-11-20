// supabase/functions/list_users/index.ts
import { corsHeaders } from "../_shared/http-utils.ts";
import { supabase, supabaseAdmin } from "../_shared/database.ts";
import type { Response } from "../../../../src/types/UserList.ts";

Deno.serve(async (req) => {
  console.log("req", req.method);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    return new Response(JSON.stringify({ error }), {
      status: 500,
      headers: corsHeaders,
    });
  }
  return new Response(
    JSON.stringify({ users: data.users } satisfies Response),
    {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
});
