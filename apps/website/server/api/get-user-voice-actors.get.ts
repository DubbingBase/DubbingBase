import { useSupabaseAdmin } from "../utils/db/client";
import { requireUser } from "../utils/auth";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const supabaseAdmin = useSupabaseAdmin();

  const query = getQuery(event);
  const page = parseInt(String(query.page || "1"));
  const limit = parseInt(String(query.limit || "10"));
  const offset = (page - 1) * limit;

  const {
    data: voiceActorLinks,
    error: vaLinkError,
    count,
  } = await supabaseAdmin
    .from("user_voice_actor_links")
    .select("voice_actor_id", { count: "exact" })
    .eq("user_id", user.id)
    .range(offset, offset + limit - 1);

  if (vaLinkError) {
    console.error("Error fetching voice actor links:", vaLinkError);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch voice actors",
    });
  }

  const voiceActorIds =
    voiceActorLinks?.map((l: any) => l.voice_actor_id) || [];
  let voiceActors: any[] = [];

  if (voiceActorIds.length > 0) {
    const { data: vaData, error: vaError } = await supabaseAdmin
      .from("voice_actors")
      .select("*")
      .in("id", voiceActorIds);

    if (vaError) {
      console.error("Error fetching voice actors:", vaError);
    } else {
      voiceActors = vaData || [];
    }
  }

  const totalCount = count || 0;
  const totalPages = Math.ceil(totalCount / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    voice_actors: voiceActors,
    pagination: {
      page,
      limit,
      total_count: totalCount,
      total_pages: totalPages,
      has_next_page: hasNextPage,
      has_prev_page: hasPrevPage,
    },
    metadata: {
      primary_voice_actor_id: voiceActors.length > 0 ? voiceActors[0].id : null,
    },
  };
});
