import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const type = query.type as string | undefined;
  const supabaseAdmin = useSupabaseAdmin();

  try {
    if (type === "jobs") {
      const { data, error } = await supabaseAdmin
        .from("jobs")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return { data };
    } else if (type === "studios") {
      const { data, error } = await supabaseAdmin
        .from("studios")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return { data };
    } else if (type === "voice_actors") {
      const { data, error } = await supabaseAdmin
        .from("voice_actors")
        .select("id, firstname, lastname")
        .order("lastname", { ascending: true });
      if (error) throw error;
      return { data };
    } else if (type === "all") {
      const { data: jobs } = await supabaseAdmin
        .from("jobs")
        .select("id, name")
        .order("name", { ascending: true });
      const { data: studios } = await supabaseAdmin
        .from("studios")
        .select("id, name")
        .order("name", { ascending: true });
      const { data: voiceActors } = await supabaseAdmin
        .from("voice_actors")
        .select("id, firstname, lastname")
        .order("lastname", { ascending: true });

      return {
        jobs: jobs || [],
        studios: studios || [],
        voiceActors: voiceActors || [],
      };
    }

    throw createError({
      statusCode: 400,
      message: "Invalid type parameter",
    });
  } catch (error: any) {
    if (error && typeof error === "object" && "statusCode" in error)
      throw error;
    console.error("Error in get-metadata route:", error);
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});
