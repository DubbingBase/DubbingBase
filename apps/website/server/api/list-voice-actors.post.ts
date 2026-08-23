import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}));
  const query = body?.query;
  const limit = parseInt(String(body?.limit)) || 100;
  const offset = parseInt(String(body?.offset)) || 0;

  const supabaseAdmin = event.context.supabaseAdmin || useSupabaseAdmin();

  try {
    let queryBuilder = supabaseAdmin
      .from("voice_actors")
      .select("*", { count: "exact" });

    if (query && typeof query === "string" && query.trim()) {
      const searchQuery = query.trim();
      queryBuilder = queryBuilder.or(
        `firstname.ilike.%${searchQuery}%,lastname.ilike.%${searchQuery}%,firstname.ilike.%${searchQuery.split(" ")[0]}%`,
      );
    }

    const { data, count, error } = await queryBuilder
      .order("lastname", { ascending: true })
      .order("firstname", { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return { voice_actors: data, total: count };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    throw createError({ statusCode: 500, message: errorMessage });
  }
});
