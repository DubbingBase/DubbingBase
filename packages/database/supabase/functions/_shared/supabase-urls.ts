/**
 * Supabase URL utility module for basic Supabase storage URL generation
 */

import { SupabaseContext } from "npm:@supabase/server@^1";
import { Database } from "./database.types.ts";

// Supabase Storage Configuration
export const SUPABASE_CONFIG = {
  // baseUrl: `${Deno.env.get('SUPABASE_URL')}/storage/v1`,
  baseUrl: ``,
  defaultBucket: "voice_actor_profile_pictures",
  defaultSize: "500",
  originalSize: "original",
} as const;

// Supported storage buckets
export const STORAGE_BUCKETS = {
  voice_actor_profile_pictures: "voice_actor_profile_pictures",
  media_images: "media_images",
  thumbnails: "thumbnails",
} as const;

export type StorageBucket = keyof typeof STORAGE_BUCKETS;

/**
 * Constructs a Supabase storage URL with specified bucket and size transformation
 */
export function buildSupabaseImageUrl(
  ctx: SupabaseContext<Database>,
  imagePath: string | null | undefined,
  bucket: StorageBucket = SUPABASE_CONFIG.defaultBucket,
  size: string = SUPABASE_CONFIG.defaultSize,
): string | null {
  if (!imagePath) return null;

  const { data: publicUrlData } = ctx.supabase.storage
    .from(bucket)
    .getPublicUrl(imagePath);

  console.log("SUPABASE_URL", Deno.env.get("SUPABASE_URL"));
  console.log("Deno.env.get(NODE_ENV)", Deno.env.get("NODE_ENV"));

  let url = publicUrlData.publicUrl;
  if (Deno.env.get("NODE_ENV") === "developement") {
    console.log("Replacing supabase url with localhost");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (supabaseUrl) {
      url = url.replace(supabaseUrl, "http://127.0.0.1:55321");
    }
  }

  return url;
}

/**
 * Safe URL processing with basic error handling
 */
export function safeProcessImageUrl(
  ctx: SupabaseContext<Database>,
  imagePath: string | null | undefined,
  options: {
    bucket?: StorageBucket;
    size?: string;
    fallbackUrl?: string;
  } = {},
): string | null {
  const {
    bucket = SUPABASE_CONFIG.defaultBucket,
    size = SUPABASE_CONFIG.defaultSize,
    fallbackUrl,
  } = options;

  if (!imagePath) {
    return fallbackUrl || null;
  }

  const processedUrl = buildSupabaseImageUrl(ctx, imagePath, bucket, size);

  if (processedUrl) return processedUrl;

  return fallbackUrl || null;
}

export const processVoiceActor = (ctx: SupabaseContext<Database>, va: any) => {
  if (!va) return null;

  return {
    ...va,
    profile_picture: buildSupabaseImageUrl(ctx, va.profile_picture),
  };
};
