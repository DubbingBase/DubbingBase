import {
  useIgdbClient,
  useOpenLibraryClient,
  usePodcastClient,
  useAdvertisementClient,
  useToyClient,
  useTmdbClient,
} from "../utils";
import { buildIgdbImageUrl } from "../utils/api/igdb";
import { setNoCacheHeaders } from "../utils/cache/http";

export default defineEventHandler(async (event) => {
  setNoCacheHeaders(event);
  const query = getQuery(event);
  const mediaType = String(query.media_type ?? "");
  const mediaId = Number(query.media_id);

  if (!mediaType || !mediaId || Number.isNaN(mediaId)) {
    throw createError({
      statusCode: 400,
      message: "media_type and media_id are required",
    });
  }

  if (mediaType === "movie" || mediaType === "tv") {
    const media = await useTmdbClient().getMediaWithCredits(
      mediaType,
      mediaId,
      "fr-FR",
    );
    return { media, mediaType };
  }

  if (mediaType === "video_game") {
    const igdbClient = useIgdbClient();
    const game = await igdbClient.getGame(mediaId);
    if (!game)
      return { media: { id: mediaId, name: "Unknown Game" }, mediaType };
    return {
      media: {
        id: game.id,
        name: game.name,
        summary: game.summary,
        cover: game.cover
          ? {
              ...game.cover,
              url: buildIgdbImageUrl(game.cover.image_id, "cover_big"),
            }
          : null,
        first_release_date: game.first_release_date
          ? new Date(game.first_release_date * 1000).toISOString().split("T")[0]
          : null,
      },
      mediaType,
    };
  }

  if (mediaType === "audiobook") {
    const client = useOpenLibraryClient();
    const book = await client.getBook(mediaId);
    if (!book)
      return { media: { id: mediaId, title: "Unknown Audiobook" }, mediaType };
    return {
      media: {
        id: book.id,
        title: book.title,
        authors: book.authors,
        cover_url: book.cover_url,
        description: book.description,
      },
      mediaType,
    };
  }

  if (mediaType === "podcast") {
    const client = usePodcastClient();
    const podcast = await client.getPodcast(mediaId);
    if (!podcast)
      return { media: { id: mediaId, title: "Unknown Podcast" }, mediaType };
    return {
      media: {
        id: podcast.id,
        title: podcast.title,
        author: podcast.author,
        cover_url: podcast.cover_url,
      },
      mediaType,
    };
  }

  if (mediaType === "advertisement") {
    const client = useAdvertisementClient();
    const ad = await client.getAdvertisement(mediaId);
    if (!ad) return { media: { id: mediaId, title: "Unknown Ad" }, mediaType };
    return {
      media: {
        id: ad.id,
        title: ad.title,
        brand: ad.brand,
        poster_url: ad.poster_url,
      },
      mediaType,
    };
  }

  if (mediaType === "toy") {
    const client = useToyClient();
    const toy = await client.getToy(mediaId);
    if (!toy) return { media: { id: mediaId, name: "Unknown Toy" }, mediaType };
    return {
      media: {
        id: toy.id,
        name: toy.name,
        manufacturer: toy.manufacturer,
        cover_url: toy.cover_url,
      },
      mediaType,
    };
  }

  throw createError({
    statusCode: 400,
    message: `Unsupported media_type: ${mediaType}`,
  });
});
