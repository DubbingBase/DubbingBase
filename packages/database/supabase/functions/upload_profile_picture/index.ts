// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase } from "../_shared/database.ts"
import { Movie, MovieResponse, Serie } from "../_shared/types.ts";
import { buildSupabaseImageUrl } from "../_shared/supabase-urls.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const formData = await req.formData()

  console.log('formData', formData)

  const file = formData.get('file') as File
  const vaId = formData.get('voice_actor_id') as string

  if (!file) {
    throw new Error('no file')
  }

  if (!vaId) {
    throw new Error('no vaId')
  }

  console.log('file', file)

  const { data, error } = await supabase.storage
    .from("voice_actor_profile_pictures")
    .upload(file.name, file);
  if (error) {
    console.error("error", error);
    return;
  }
  console.log("data", data);
  console.log("error", error);

  const { data: data2, error: error2 } = await supabase
    .from("voice_actors")
    .update({
      profile_picture: data.path,
    })
    .eq("id", vaId)
    .single();

  console.log("data2", data2);
  console.log("error2", error2);

  return new Response(
    JSON.stringify({
      ok: true,
      fullPath: data.path,
      publicUrl: buildSupabaseImageUrl(data.path)
    }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    },
  )
})
