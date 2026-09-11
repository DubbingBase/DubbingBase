import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  setHeader(
    event,
    "Cache-Control",
    "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
  );

  const query = getQuery(event);
  const searchQuery = query.query as string | undefined;
  const requestedLimit = Number.parseInt(String(query.limit), 10);
  const requestedOffset = Number.parseInt(String(query.offset), 10);
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 100;
  const offset = Number.isFinite(requestedOffset)
    ? Math.max(requestedOffset, 0)
    : 0;

  const supabaseAdmin = event.context.supabaseAdmin || useSupabaseAdmin();

  try {
    let queryBuilder = supabaseAdmin
      .from("voice_actors")
      .select("*", { count: "exact" });

    if (searchQuery && typeof searchQuery === "string" && searchQuery.trim()) {
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
    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";
    throw createError({ statusCode: 500, message: errorMessage });
  }
});
