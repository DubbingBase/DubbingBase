import { useSupabaseAdmin } from "../utils/db/client";
import { buildSupabaseImageUrl } from "../utils/urls/supabase";
import type { Database } from "@app/supabase/types";

type VoiceActorDirectoryRow = Pick<
  Database["public"]["Tables"]["voice_actors"]["Row"],
  "id" | "firstname" | "lastname" | "profile_picture"
>;

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const searchQuery = query.query as string | undefined;
  const directoryView = query.view === "directory";
  const requestedLimit = Number.parseInt(String(query.limit), 10);
  const requestedOffset = Number.parseInt(String(query.offset), 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 100;
  const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;

  const supabaseAdmin = event.context.supabaseAdmin || useSupabaseAdmin();

  try {
    if (directoryView) {
      let queryBuilder = supabaseAdmin
        .from("voice_actors")
        .select("id, firstname, lastname, profile_picture", { count: "exact" });

      if (searchQuery && searchQuery.trim()) {
        const search = searchQuery.trim();
        queryBuilder = queryBuilder.or(
          `firstname.ilike.%${search}%,lastname.ilike.%${search}%,firstname.ilike.%${search.split(" ")[0]}%`,
        );
      }

      const { data, count, error } = await queryBuilder
        .order("lastname", { ascending: true })
        .order("firstname", { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        voice_actors: (data ?? []).map((actor: VoiceActorDirectoryRow) => ({
          id: actor.id,
          firstname: actor.firstname,
          lastname: actor.lastname,
          profile_picture_url: buildSupabaseImageUrl(
            actor.profile_picture,
            "voice_actor_profile_pictures",
            "500",
          ),
        })),
        total: count ?? 0,
      };
    }

    let queryBuilder = supabaseAdmin.from("voice_actors").select("*", { count: "exact" });

    if (searchQuery && searchQuery.trim()) {
      const search = searchQuery.trim();
      queryBuilder = queryBuilder.or(
        `firstname.ilike.%${search}%,lastname.ilike.%${search}%,firstname.ilike.%${search.split(" ")[0]}%`,
      );
    }

    const { data, count, error } = await queryBuilder
      .order("lastname", { ascending: true })
      .order("firstname", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return { voice_actors: data, total: count ?? 0 };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    throw createError({ statusCode: 500, message: errorMessage });
  }
});
