import { randomUUID } from "node:crypto";
import { requireUser } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";
import { buildSupabaseImageUrl } from "../utils/urls/supabase";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

type ImageContentType = "image/jpeg" | "image/png" | "image/webp";

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

export default defineEventHandler(async (event) => {
  const user = requireUser(event);

  try {
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
    if (user.app_metadata?.role !== "admin") {
      const { data: link, error: linkError } = await supabaseAdmin
        .from("user_voice_actor_links")
        .select("voice_actor_id")
        .eq("user_id", user.id)
        .eq("voice_actor_id", vaId)
        .maybeSingle();

      if (linkError || !link) {
        throw createError({
          statusCode: 403,
          message: "Unauthorized to update this voice actor",
        });
      }
    }

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

    const filePath = `${vaId}/${randomUUID()}.${imageType.extension}`;
    const { data: uploadedFile, error: uploadError } = await supabaseAdmin.storage
      .from("voice_actor_profile_pictures")
      .upload(filePath, fileField.data, { contentType, upsert: false });

    if (uploadError || !uploadedFile) {
      console.error("Failed to upload voice actor profile picture");
      throw createError({ statusCode: 502, message: "Image upload failed" });
    }

    const { data: updatedVoiceActor, error: updateError } = await supabaseAdmin
      .from("voice_actors")
      .update({ profile_picture: uploadedFile.path })
      .eq("id", vaId)
      .select("id")
      .maybeSingle();

    if (updateError || !updatedVoiceActor) {
      const { error: cleanupError } = await supabaseAdmin.storage
        .from("voice_actor_profile_pictures")
        .remove([uploadedFile.path]);
      if (cleanupError) {
        console.error("Failed to clean up staged voice actor profile picture");
      }
      console.error("Failed to update voice actor profile picture");
      throw createError({
        statusCode: 500,
        message: "Unable to save profile picture",
      });
    }

    const previousPath = voiceActor.profile_picture;
    if (previousPath && !previousPath.startsWith("http") && previousPath !== uploadedFile.path) {
      const { error: removeError } = await supabaseAdmin.storage
        .from("voice_actor_profile_pictures")
        .remove([previousPath]);
      if (removeError) {
        console.error("Failed to remove replaced voice actor profile picture");
      }
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
