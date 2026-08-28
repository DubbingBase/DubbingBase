import { fetchShowData } from "./[id].get";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const id = query.id as string | undefined;
  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const showId = parseInt(id, 10);
  if (isNaN(showId)) {
    throw createError({ statusCode: 400, message: "Invalid id parameter" });
  }

  return await fetchShowData(event, showId);
});
