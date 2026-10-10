import { getRequestHeader, getRequestIP, type H3Event } from "h3";
import { randomUUID } from "node:crypto";
import { useSupabaseAdmin } from "../utils/db/client";
import { buildSupabaseImageUrl } from "../utils/urls/supabase";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const RATE_LIMITER_BINDING = "PROFILE_PICTURE_UPLOAD_LIMITER";
const RATE_LIMIT_KEY_PREFIX = "voice-actor-picture-upload:";

type ImageContentType = "image/jpeg" | "image/png" | "image/webp";
type UploadRateLimiter = {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
};

const imageTypes = {
  "image/jpeg": {
    extension: "jpg",
    matches: (data: Buffer) =>
      data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff,
  },
  "image/png": {
    extension: "png",
    matches: (data: Buffer) =>
      data.length >= 8 &&
      data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  "image/webp": {
    extension: "webp",
    matches: (data: Buffer) =>
      data.length >= 12 &&
      data.toString("ascii", 0, 4) === "RIFF" &&
      data.toString("ascii", 8, 12) === "WEBP",
  },
} satisfies Record<ImageContentType, { extension: string; matches: (data: Buffer) => boolean }>;

function isImageContentType(value: string | undefined): value is ImageContentType {
  return value !== undefined && Object.hasOwn(imageTypes, value);
}

function readProperty(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return Reflect.get(value, key);
}

function isUploadRateLimiter(value: unknown): value is UploadRateLimiter {
  return typeof readProperty(value, "limit") === "function";
}

function getUploadRateLimiter(event: H3Event): UploadRateLimiter | undefined {
  const cloudflare = readProperty(event.context, "cloudflare");
  const env = readProperty(cloudflare, "env");
  const binding = readProperty(env, RATE_LIMITER_BINDING);
  if (isUploadRateLimiter(binding)) return binding;
  if (cloudflare) {
    throw createError({
      statusCode: 503,
      message: "Upload protection is unavailable",
    });
  }
  return undefined;
}

function isActorPicturePath(path: string, voiceActorId: number): boolean {
  const legacyPath = new RegExp(`^${voiceActorId}\\.(?:jpe?g|png|webp)$`, "i");
  const versionedPath = new RegExp(
    `^${voiceActorId}/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\\.(?:jpe?g|png|webp)$`,
    "i",
  );
  return legacyPath.test(path) || versionedPath.test(path);
}

async function removePictureBestEffort(
  supabaseAdmin: ReturnType<typeof useSupabaseAdmin>,
  path: string,
  logMessage: string,
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.storage
      .from("voice_actor_profile_pictures")
      .remove([path]);
    if (error) console.error(logMessage);
  } catch {
    console.error(logMessage);
  }
}

export default defineEventHandler(async (event) => {
  try {
    const rateLimiter = getUploadRateLimiter(event);
    if (rateLimiter) {
      const clientIp =
        getRequestHeader(event, "cf-connecting-ip") ??
        getRequestIP(event, { xForwardedFor: false });
      if (!clientIp) {
        throw createError({
          statusCode: 503,
          message: "Upload protection is unavailable",
        });
      }

      let allowed: boolean;
      try {
        ({ success: allowed } = await rateLimiter.limit({
          key: `${RATE_LIMIT_KEY_PREFIX}${clientIp}`,
        }));
      } catch {
        throw createError({
          statusCode: 503,
          message: "Upload protection is unavailable",
        });
      }
      if (!allowed) {
        throw createError({
          statusCode: 429,
          message: "Too many picture uploads. Try again later.",
        });
      }
    }

    const formData = await readMultipartFormData(event);
    if (!formData) {
      throw createError({ statusCode: 400, message: "No form data provided" });
    }

    const fileField = formData.find((field) => field.name === "file");
    const vaIdField = formData.find((field) => field.name === "voice_actor_id");
    const vaIdText = vaIdField?.data.toString();
    const vaId = vaIdText && /^[1-9]\d*$/.test(vaIdText) ? Number(vaIdText) : NaN;

    if (!Number.isSafeInteger(vaId) || vaId <= 0) {
      throw createError({ statusCode: 400, message: "Invalid voice_actor_id" });
    }

    if (!fileField?.data?.length) {
      throw createError({ statusCode: 400, message: "Image file is required" });
    }

    if (fileField.data.length > MAX_FILE_SIZE) {
      throw createError({
        statusCode: 413,
        message: "Image must be 5 MiB or smaller",
      });
    }

    const contentType = fileField.type?.toLowerCase();
    if (!isImageContentType(contentType) || !imageTypes[contentType].matches(fileField.data)) {
      throw createError({
        statusCode: 415,
        message: "Only valid JPEG, PNG, and WebP images are supported",
      });
    }
    const imageType = imageTypes[contentType];

    const supabaseAdmin = useSupabaseAdmin();
    const { data: voiceActor, error: voiceActorError } = await supabaseAdmin
      .from("voice_actors")
      .select("id, profile_picture")
      .eq("id", vaId)
      .maybeSingle();

    if (voiceActorError) {
      console.error("Failed to read voice actor before profile picture upload");
      throw createError({
        statusCode: 500,
        message: "Unable to verify voice actor",
      });
    }
    if (!voiceActor) {
      throw createError({ statusCode: 404, message: "Voice actor not found" });
    }

    const user = event.context.user;
    const isAdmin = user?.app_metadata?.role === "admin";
    const previousPicture = voiceActor.profile_picture;
    const isFirstUpload = previousPicture === null || previousPicture === "";
    if (!isFirstUpload && !isAdmin) {
      throw createError({
        statusCode: 403,
        message: "Only admins can replace a profile picture",
      });
    }

    const filePath = `${vaId}/${randomUUID()}.${imageType.extension}`;
    const { data: uploadedFile, error: uploadError } = await supabaseAdmin.storage
      .from("voice_actor_profile_pictures")
      .upload(filePath, fileField.data, { contentType, upsert: false });

    if (uploadError || !uploadedFile) {
      console.error("Failed to upload voice actor profile picture");
      throw createError({ statusCode: 502, message: "Image upload failed" });
    }

    let updateQuery = supabaseAdmin
      .from("voice_actors")
      .update({ profile_picture: uploadedFile.path })
      .eq("id", vaId);
    if (previousPicture === null) {
      updateQuery = updateQuery.is("profile_picture", null);
    } else {
      updateQuery = updateQuery.eq("profile_picture", previousPicture);
    }

    const { data: updatedVoiceActor, error: updateError } = await updateQuery
      .select("id")
      .maybeSingle();

    if (updateError || !updatedVoiceActor) {
      await removePictureBestEffort(
        supabaseAdmin,
        uploadedFile.path,
        "Failed to clean up staged voice actor profile picture",
      );
      if (updateError) {
        console.error("Failed to update voice actor profile picture");
        throw createError({
          statusCode: 500,
          message: "Unable to save profile picture",
        });
      }
      throw createError({
        statusCode: 409,
        message: "Profile picture changed during upload. Try again.",
      });
    }

    if (previousPicture && isActorPicturePath(previousPicture, vaId)) {
      await removePictureBestEffort(
        supabaseAdmin,
        previousPicture,
        "Failed to remove replaced voice actor profile picture",
      );
    }

    return {
      ok: true,
      fullPath: uploadedFile.path,
      publicUrl: buildSupabaseImageUrl(uploadedFile.path),
    };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error("Error in upload_profile_picture");
    throw createError({
      statusCode: 500,
      message: "Unable to upload profile picture",
    });
  }
});
