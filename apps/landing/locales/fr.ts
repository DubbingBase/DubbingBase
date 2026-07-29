export default defineI18nLocale(async (locale) => {
  const { fr } = await import("@app/locales");
  return fr;
});
