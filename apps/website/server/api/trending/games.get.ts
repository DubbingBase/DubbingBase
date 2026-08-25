import { useCache, useIgdbClient } from "../../utils";
import { buildIgdbImageUrl } from "../../utils/api/igdb";
import type { IgdbGame } from "@app/shared-logic";

const CACHE_KEY = "igdb:trending:games:formatted:v2";

function formatGame(game: IgdbGame) {
  return {
    ...game,
    media_type: "video_game" as const,
    cover: game.cover
      ? {
          ...game.cover,
          url: buildIgdbImageUrl(game.cover.image_id, "cover_big"),
        }
      : undefined,
  };
}

export default defineEventHandler(async (event) => {
  const cache = useCache();
  const config = useRuntimeConfig();
  const debug = getQuery(event)?.igdb_debug != null;

  const idVal = config.igdbClientId || "";
  const secretVal = config.igdbClientSecret || "";
  // TEMP DEBUG: metadata only, never secret values
  const credMeta = {
    idLen: idVal.length,
    secretLen: secretVal.length,
    idHasWhitespace: /\s/.test(idVal),
    secretHasWhitespace: /\s/.test(secretVal),
    kvBound: !!(event.context.cloudflare?.env as any)?.CACHE_KV,
  };

  if (!idVal || !secretVal) {
    return debug ? { debug: "config_missing", ...credMeta } : [];
  }

  const igdbClient = useIgdbClient();

  const cached = await cache.get<ReturnType<typeof formatGame>[]>(CACHE_KEY);
  if (cached) {
    return cached;
  }

  try {
    const games = await igdbClient.getTrendingGames(20);
    const formatted = games.map(formatGame);

    await cache.set(CACHE_KEY, formatted, "SHORT");

    return formatted;
  } catch (err) {
    console.error("[trending/games] IGDB query failed:", err);
    // TEMP DEBUG: surface real error for diagnosis, remove once fixed
    if (debug) {
      const e = err as Error & { cause?: unknown };
      return {
        debug: "igdb_call_failed",
        ...credMeta,
        name: e?.name,
        message: e?.message,
        cause: String(e?.cause ?? ""),
      };
    }
    return [];
  }
});
