import { useToyClient } from "../../utils";

export default defineEventHandler(async (event) => {
  const rawId = getRouterParam(event, "id");
  if (!rawId || !/^-?\d+$/.test(rawId)) {
    throw createError({ statusCode: 400, message: "Invalid toy id" });
  }

  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id === 0) {
    throw createError({ statusCode: 400, message: "Invalid toy id" });
  }

  return { toy: await useToyClient().getToy(id) };
});
