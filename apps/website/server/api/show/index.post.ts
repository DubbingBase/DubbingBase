import { fetchShowData } from "./[id].get";

export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}));
  const id = body?.id;
  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const showId = parseInt(String(id), 10);
  if (isNaN(showId)) {
    throw createError({ statusCode: 400, message: "Invalid id parameter" });
  }

  return await fetchShowData(event, showId);
});
