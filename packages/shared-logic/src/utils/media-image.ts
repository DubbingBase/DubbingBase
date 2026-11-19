const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
const TMDB_IMAGE_URL = /^https:\/\/image\.tmdb\.org\/t\/p\/(?:original|w\d+)(\/[^\s]+)$/;
const ABSOLUTE_URL = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;
const IGDB_IMAGE_BASE = "https://images.igdb.com/igdb/image/upload";
const IGDB_IMAGE_URL =
  /^(?:https:)?\/\/images\.igdb\.com\/igdb\/image\/upload\/t_[\w]+\/([\w-]+)\.[\w]+$/;

export const VOICE_ACTOR_IMAGE_BUCKET = "voice_actor_profile_pictures";

type TmdbImageSize = "original" | "w92" | "w185" | "w342" | "w500" | "w780" | "w1280";
type IgdbImageSize = "thumb" | "cover_small" | "cover_big" | "screenshot_huge" | "1080p";
type PublicImageBucket = typeof VOICE_ACTOR_IMAGE_BUCKET | "studio_logos";

export type MediaImageOptions = {
  tmdbSize?: TmdbImageSize;
  igdbSize?: IgdbImageSize;
} & (
  | { storageBase: string; storageBucket?: PublicImageBucket }
  | { storageBase?: undefined; storageBucket?: never }
);

export function getTmdbImagePath(
  image: string | null | undefined,
  source: "url" | "reference" = "reference",
): string | null {
  if (!image) return null;
  const path = TMDB_IMAGE_URL.exec(image)?.[1];
  if (path) return path;
  if (source === "url" || ABSOLUTE_URL.test(image)) return null;
  return image.startsWith("/") ? image : `/${image}`;
}

export function resolveMediaImage(
  image: string | null | undefined,
  options: MediaImageOptions = {},
): string | null {
  if (!image) return null;

  if (image.startsWith("igdb:") || options.igdbSize) {
    const hash = image.startsWith("igdb:")
      ? image.slice(5)
      : (IGDB_IMAGE_URL.exec(image)?.[1] ?? (/^[\w-]+$/.test(image) ? image : null));
    if (hash && /^[\w-]+$/.test(hash)) {
      return `${IGDB_IMAGE_BASE}/t_${options.igdbSize ?? "cover_big"}/${hash}.jpg`;
    }
    if (image.startsWith("igdb:")) return null;
  }

  const storagePath = image.startsWith("storage:")
    ? image.slice(8)
    : options.storageBucket && !ABSOLUTE_URL.test(image) && !image.startsWith("/supabase/")
      ? `${options.storageBucket}/${image.replace(/^\/+/, "")}`
      : null;
  if (storagePath !== null) {
    if (!options.storageBase) return null;
    const segments = storagePath.split("/");
    if (
      segments.length < 2 ||
      segments.some((segment) => !segment || segment === "." || segment === "..")
    ) {
      return null;
    }
    const path = segments.map(encodeURIComponent).join("/");
    return `${options.storageBase.replace(/\/$/, "")}/storage/v1/object/public/${path}`;
  }

  const path = options.tmdbSize ? getTmdbImagePath(image) : null;
  return path ? `${TMDB_IMAGE_BASE}/${options.tmdbSize}${path}` : image;
}
