export function getLanguageDisplayName(
  langCode: string,
  uiLocale: string = "fr",
): string {
  if (!langCode) return "";
  try {
    const displayNames = new Intl.DisplayNames([uiLocale], {
      type: "language",
    });
    const name = displayNames.of(langCode);
    if (!name || typeof name !== "string") return langCode.toUpperCase();

    // Capitalize the first letter
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch (e) {
    return langCode.toUpperCase();
  }
}
