export default defineEventHandler(() => {
  throw createError({ statusCode: 405, message: "Method not allowed" });
});
