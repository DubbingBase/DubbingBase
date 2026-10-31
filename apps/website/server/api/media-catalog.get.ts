import type {
  Advertisement,
  Audiobook,
  IgdbGame,
  PaginatedResponse,
  Podcast,
  Toy,
} from "@app/shared-logic";
import {
  useAdvertisementClient,
  useIgdbClient,
  useOpenLibraryClient,
  usePodcastClient,
  useToyClient,
} from "../utils";
import { useSupabaseAdmin } from "../utils/db/client";
import { buildIgdbImageUrl } from "../utils/api/igdb";
import { paginateArray } from "../utils/pagination";

const MEDIA_CATEGORIES = {
  game: { contentType: "video_game", path: "/game" },
  audiobook: { contentType: "audiobook", path: "/audiobook" },
  podcast: { contentType: "podcast", path: "/podcast" },
  advertisement: { contentType: "advertisement", path: "/advertisement" },
  toy: { contentType: "toy", path: "/toy" },
} as const;

type MediaCategory = keyof typeof MEDIA_CATEGORIES;
type NonGameCategory = Exclude<MediaCategory, "game">;

type CatalogItem = {
  id: number;
  title: string;
  coverUrl: string | null;
  href: string;
};

function isMediaCategory(value: unknown): value is MediaCategory {
  return typeof value === "string" && Object.hasOwn(MEDIA_CATEGORIES, value);
}

function catalogItem(
  category: MediaCategory,
  id: number,
  title: string,
  coverUrl: string | null,
): CatalogItem {
  return {
    id,
    title,
    coverUrl,
    href: `${MEDIA_CATEGORIES[category].path}/${id}`,
  };
}

async function resolveCatalogItem(category: NonGameCategory, id: number): Promise<CatalogItem> {
  const fallbackTitle = {
    audiobook: `Audiobook #${id}`,
    podcast: `Podcast #${id}`,
    advertisement: `Commercial #${id}`,
    toy: `Toy #${id}`,
  }[category];

  try {
    switch (category) {
      case "audiobook": {
        const audiobook: Audiobook | null = await useOpenLibraryClient().getBook(id);
        return catalogItem(
          category,
          id,
          audiobook?.title || fallbackTitle,
          audiobook?.cover_url || null,
        );
      }
      case "podcast": {
        const podcast: Podcast | null = await usePodcastClient().getPodcast(id);
        return catalogItem(
          category,
          id,
          podcast?.title || fallbackTitle,
          podcast?.cover_url || null,
        );
      }
      case "advertisement": {
        const advertisement: Advertisement | null =
          await useAdvertisementClient().getAdvertisement(id);
        return catalogItem(
          category,
          id,
          advertisement?.title || fallbackTitle,
          advertisement?.poster_url || null,
        );
      }
      case "toy": {
        const toy: Toy | null = await useToyClient().getToy(id);
        return catalogItem(category, id, toy?.name || fallbackTitle, toy?.cover_url || null);
      }
    }
  } catch (error: unknown) {
    console.error(`[media-catalog] Failed to load ${category} ${id}:`, error);
  }

  return catalogItem(category, id, fallbackTitle, null);
}

async function resolveGameCatalogItems(ids: number[]): Promise<CatalogItem[]> {
  if (ids.length === 0) return [];

  try {
    const games = await useIgdbClient().query<IgdbGame>(
      "games",
      `fields id, name, cover.image_id;
       where id = (${ids.join(",")});
       limit ${ids.length};`,
    );
    const gamesById = new Map(games.map((game) => [game.id, game]));

    return ids.map((id) => {
      const game = gamesById.get(id);
      return catalogItem(
        "game",
        id,
        game?.name || `Video Game #${id}`,
        game?.cover ? buildIgdbImageUrl(game.cover.image_id, "cover_big") : null,
      );
    });
  } catch (error: unknown) {
    console.error("[media-catalog] Failed to load game metadata:", error);
    return ids.map((id) => catalogItem("game", id, `Video Game #${id}`, null));
  }
}

export default defineEventHandler(async (event): Promise<PaginatedResponse<CatalogItem>> => {
  const category = getQuery(event).type;
  if (!isMediaCategory(category)) {
    throw createError({ statusCode: 400, message: "Invalid media type" });
  }

  const supabase = useSupabaseAdmin(event);
  const contentIds = new Set<number>();
  const batchSize = 500;

  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await supabase
      .from("dubbing_projects")
      .select("id, content_id, created_at")
      .eq("content_type", MEDIA_CATEGORIES[category].contentType)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error(`[media-catalog] Failed to load ${category} IDs:`, error);
      throw createError({ statusCode: 500, message: "Failed to load media catalog" });
    }

    for (const row of data || []) contentIds.add(row.content_id);
    if (!data || data.length < batchSize) break;
  }

  const { items, pagination } = paginateArray([...contentIds], getQuery(event));
  const catalogItems =
    category === "game"
      ? await resolveGameCatalogItems(items)
      : await Promise.all(items.map((id) => resolveCatalogItem(category, id)));

  return { data: catalogItems, pagination };
});
