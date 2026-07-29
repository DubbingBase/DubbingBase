export default defineI18nLocale(async (locale) => {
  const { en } = await import("@app/locales");
  return en;
});
