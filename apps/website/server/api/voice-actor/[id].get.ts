import { useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import { APP_LOCALES } from "@app/shared-logic";
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const voiceActorId = Number(id);
  if (!Number.isSafeInteger(voiceActorId) || voiceActorId < 1) {
    throw createError({ statusCode: 404, statusMessage: "Voice actor not found" });
  }
  // TMDB language follows the route locale (?lang=), not the ambient browser
  // header: titles must match the page language. Allowlisted to the 4
  // canonical tags so cache keys stay collapsed; header is the fallback.
  const query = getQuery(event);
  const rawLang = typeof query.lang === "string" ? query.lang.trim() : "";
  const canonicalLangs = APP_LOCALES.map((l) => l.language);
  const shortToCanonical: Record<string, string> = Object.fromEntries(
    APP_LOCALES.map((l) => [l.code, l.language]),
  );
  const headerLang =
    (getHeader(event, "accept-language") || "fr-FR").split(",")[0]?.trim() || "fr-FR";
  const acceptLanguage = canonicalLangs.includes(rawLang)
    ? rawLang
    : shortToCanonical[rawLang] || headerLang;
  try {
    const tmdbClient = useTmdbClient();
    const mediaService = new MediaService(tmdbClient, acceptLanguage);
    const baseData = await mediaService.getVoiceActorWithWorkAndMedia(voiceActorId, acceptLanguage);
    return baseData;
  } catch (error) {
    console.error("Error fetching voice actor:", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
    ) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      message: "Failed to fetch voice actor data",
    });
  }
});
