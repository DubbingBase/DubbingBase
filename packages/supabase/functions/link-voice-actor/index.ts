import { corsHeaders } from "../_shared/http-utils.ts";
import { supabase } from "../_shared/database.ts";
import { Database } from "../_shared/database.types.ts";

console.log("link-voice-actor function started");

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get the authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        },
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        },
      );
    }

    const requestData = await req.json();
    const {
      voice_actor_id,
      media_type,
      media_id,
      character_name,
      role,
      targetUserId,
      actor_id,
    } = requestData;

    if (
      !voice_actor_id || !media_type || !media_id || !actor_id
    ) {
      return new Response(
        JSON.stringify({
          error:
            "Missing required fields: actor_id, voice_actor_id, media_type, and media_id are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if user is admin for impersonation
    const isAdmin = user.app_metadata?.role === "admin" ||
      user.user_metadata?.role === "admin" ||
      user.role === "admin";

    if (targetUserId && !isAdmin) {
      return new Response(
        JSON.stringify({
          error: "Unauthorized: Admin access required for impersonation",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        },
      );
    }

    // Validate media_type
    const validMediaTypes = ["movie", "serie"];
    if (!validMediaTypes.includes(media_type)) {
      return new Response(
        JSON.stringify({
          error: "Invalid media_type. Must be one of: movie, serie",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify voice actor exists
    const { data: voiceActor, error: voiceActorError } = await supabase
      .from("voice_actors")
      .select("*")
      .eq("id", voice_actor_id)
      .single();

    if (voiceActorError || !voiceActor) {
      return new Response(
        JSON.stringify({ error: "Voice actor not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Check if the link already exists
    const query = supabase
      .from("work")
      .select("*")
      .eq("voice_actor_id", voice_actor_id)
      .eq("content_type", media_type)
      .eq("content_id", media_id);

    if (actor_id) {
      query.eq("actor_id", actor_id);
    } else {
      query.is("actor_id", null);
    }
    const { data: existingLink, error: linkCheckError } = await query
      .maybeSingle();

    if (linkCheckError) {
      console.error("Error checking for existing link:", linkCheckError);
      throw linkCheckError;
    }

    let result;

    if (existingLink) {
      result = existingLink;
    } else {
      // Create new link
      const insertData = {
        voice_actor_id,
        content_type: media_type,
        content_id: media_id,
        performance: character_name || role || "dialogues",
        status: "user",
        actor_id: actor_id || null,
      };

      const { data, error } = await supabase
        .from("work")
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    // Get the full voice actor details to return
    const { data: voiceActorDetails, error: detailsError } = await supabase
      .from("voice_actors")
      .select("*")
      .eq("id", voice_actor_id)
      .single();

    if (detailsError) throw detailsError;

    const response = {
      ...(result as any),
      voiceActorDetails: voiceActorDetails,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in link-voice-actor:", error);
    const err = error as any;
    return new Response(
      JSON.stringify({
        error: err?.message || "Internal server error",
        details: err?.details || null,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
