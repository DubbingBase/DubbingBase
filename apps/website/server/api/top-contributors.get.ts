import { getTopContributors } from "../utils/db/queries";
import type { Json } from "@app/supabase/types";

function getMetadataString(metadata: Json, key: string): string | undefined {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    return undefined;
  }

  const value = Reflect.get(metadata, key);
  return typeof value === "string" ? value : undefined;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const limit = Number(query.limit) || 10;
  const homeProjection = query.projection === "home";

  if (typeof limit !== "number" || limit < 1 || limit > 100) {
    throw createError({
      statusCode: 400,
      message: "Limit must be a number between 1 and 100",
    });
  }

  try {
    const results = await getTopContributors(limit);

    if (!homeProjection) return results;

    return results.map((contributor) => ({
      ...contributor,
      raw_user_meta_data: {
        username: getMetadataString(contributor.raw_user_meta_data, "username"),
        avatar_url: getMetadataString(contributor.raw_user_meta_data, "avatar_url"),
      },
    }));
  } catch (error) {
    console.error("Error in top-contributors:", error);
    throw createError({
      statusCode: 500,
      message: "Internal server error",
    });
  }
});
