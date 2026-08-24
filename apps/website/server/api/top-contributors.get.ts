import { getTopContributors } from "../utils/db/queries";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const limit = Number(query.limit) || 10;

  if (typeof limit !== "number" || limit < 1 || limit > 100) {
    throw createError({
      statusCode: 400,
      message: "Limit must be a number between 1 and 100",
    });
  }

  try {
    const results = await getTopContributors(limit);
    return results;
  } catch (error) {
    console.error("Error in top-contributors:", error);
    throw createError({
      statusCode: 500,
      message: "Internal server error",
    });
  }
});
