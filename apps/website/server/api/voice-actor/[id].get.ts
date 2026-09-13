import { useTmdbClient } from "../../utils";
import { MediaService } from "../../utils/services/media";
import { APP_LOCALES } from "@app/shared-logic";
import { setPublicCacheHeaders } from "../../utils/cache/http";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, message: "Missing id parameter" });
  }

  const voiceActorId = parseInt(id, 10);
  if (isNaN(voiceActorId)) {
    throw createError({ statusCode: 400, message: "Invalid id parameter" });
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
    (getHeader(event, "accept-language") || "fr-FR").split(",")[0]?.trim() ||
    "fr-FR";
  const acceptLanguage = canonicalLangs.includes(rawLang)
    ? rawLang
    : shortToCanonical[rawLang] || headerLang;

  setPublicCacheHeaders(event, "detail");

  try {
    const tmdbClient = useTmdbClient();
    const mediaService = new MediaService(tmdbClient, acceptLanguage);
    const baseData = await mediaService.getVoiceActorWithWorkAndMedia(
      voiceActorId,
      acceptLanguage,
    );
    return baseData;
  } catch (error) {
    console.error("Error fetching voice actor:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to fetch voice actor data",
    });
  }
});
