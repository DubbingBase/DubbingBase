import type { Json } from "@app/supabase/types";
import { requireUser } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

const voiceActorFields = new Set([
  "firstname",
  "lastname",
  "bio",
  "nationality",
  "date_of_birth",
  "awards",
  "years_active",
  "social_media_links",
  "profile_picture",
  "tmdb_id",
  "wikidata_id",
  "status",
]);
const administratorFields = new Set([
  "firstname",
  "lastname",
  "profile_picture",
  "tmdb_id",
  "wikidata_id",
  "status",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJson(value: unknown): value is Json {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJson);
  if (isRecord(value)) return Object.values(value).every(isJson);
  return false;
}

function stableJsonStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJsonStringify).join(",")}]`;
  if (isRecord(value)) {
    const entries = Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJsonStringify(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function sha256(value: BufferSource): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function badRequest(message: string): never {
  throw createError({ statusCode: 400, message });
}

function parseVoiceActorId(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function uploadExternalPicture(
  supabaseAdmin: ReturnType<typeof useSupabaseAdmin>,
  voiceActorId: number,
  requestId: string,
  operationHash: string,
  pictureUrl: string,
): Promise<{ path: string; created: boolean } | null> {
  const config = useRuntimeConfig();
  const supabaseUrl = config.supabaseUrl || "127.0.0.1";
  if (pictureUrl.includes(supabaseUrl) || pictureUrl.includes("supabase.co")) {
    return null;
  }

  try {
    const imageResponse = await fetch(pictureUrl);
    if (!imageResponse.ok) return null;

    const arrayBuffer = await imageResponse.arrayBuffer();
    const contentHash = await sha256(arrayBuffer);
    const pathname = new URL(pictureUrl).pathname;
    const extension =
      pathname.match(/\.(jpg|jpeg|png|webp|gif|avif)$/i)?.[1]?.toLowerCase() ?? "jpg";
    const path = `${voiceActorId}-${requestId.toLowerCase()}-${operationHash}-${contentHash}.${extension}`;
    const bucket = supabaseAdmin.storage.from("voice_actor_profile_pictures");
    const { error } = await bucket.upload(path, arrayBuffer, {
      contentType: imageResponse.headers.get("content-type") || "image/jpeg",
      upsert: false,
    });
    if (error) {
      const { data: existingFiles } = await bucket.list("", { search: path });
      if (existingFiles?.some((file) => file.name === path)) {
        return { path, created: false };
      }
      console.error("Failed to stage voice actor profile picture");
      return null;
    }
    return { path, created: true };
  } catch {
    return null;
  }
}

async function removeStagedPicture(
  supabaseAdmin: ReturnType<typeof useSupabaseAdmin>,
  path: string,
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.storage
      .from("voice_actor_profile_pictures")
      .remove([path]);
    if (error) console.error("Failed to clean up staged voice actor profile picture");
  } catch {
    console.error("Failed to clean up staged voice actor profile picture");
  }
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const body: unknown = await readBody(event);

  if (!isRecord(body) || !isRecord(body.updates) || !isJson(body.updates)) {
    badRequest("A valid voice actor update is required");
  }
  if (
    Object.keys(body).some(
      (key) => !["voice_actor_id", "updates", "expected_updated_at", "request_id"].includes(key),
    )
  ) {
    badRequest("Request contains a protected or unknown field");
  }

  const voiceActorId = parseVoiceActorId(body.voice_actor_id);
  if (voiceActorId === null) badRequest("voice_actor_id must be a positive integer");
  if (Object.keys(body.updates).length === 0) badRequest("At least one update field is required");

  const isAdmin = user.app_metadata?.role === "admin";
  if (Object.keys(body.updates).some((key) => !voiceActorFields.has(key))) {
    badRequest("Voice actor update contains a protected or unknown field");
  }
  if (
    !isAdmin &&
    Object.keys(body.updates).some(
      (key) => administratorFields.has(key) || key === "profile_picture",
    )
  ) {
    throw createError({
      statusCode: 403,
      message: "Only admins can modify this voice actor field",
    });
  }

  const payload = { ...body.updates };
  if (payload.date_of_birth === "") payload.date_of_birth = null;

  const expectedUpdatedAt = body.expected_updated_at;
  if (typeof expectedUpdatedAt !== "string" || !Number.isFinite(Date.parse(expectedUpdatedAt))) {
    badRequest("expected_updated_at must be a valid timestamp");
  }

  const requestId = body.request_id;
  if (
    typeof requestId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)
  ) {
    badRequest("request_id must be a UUID");
  }
  const operationHash = await sha256(
    new TextEncoder().encode(
      stableJsonStringify({
        voice_actor_id: voiceActorId,
        expected_updated_at: expectedUpdatedAt,
        updates: payload,
      }),
    ),
  );

  const supabaseAdmin = useSupabaseAdmin();
  let stagedPicturePath: string | null = null;
  let stagedPictureCreated = false;
  if (
    typeof payload.profile_picture === "string" &&
    /^https?:\/\//i.test(payload.profile_picture)
  ) {
    const stagedPicture = await uploadExternalPicture(
      supabaseAdmin,
      voiceActorId,
      requestId,
      operationHash,
      payload.profile_picture,
    );
    if (stagedPicture) {
      stagedPicturePath = stagedPicture.path;
      stagedPictureCreated = stagedPicture.created;
      payload.profile_picture = stagedPicture.path;
    }
  }

  const rpcArgs = {
    p_actor_id: user.id,
    p_voice_actor_id: voiceActorId,
    p_payload: payload,
    p_expected_updated_at: expectedUpdatedAt,
    p_request_id: requestId,
  };
  const { data, error } = await supabaseAdmin.rpc("controlled_update_voice_actor", rpcArgs);

  if (error) {
    if (stagedPictureCreated && stagedPicturePath) {
      await removeStagedPicture(supabaseAdmin, stagedPicturePath);
    }
    if (error.code === "42501") {
      throw createError({ statusCode: 403, message: "Unauthorized to update this voice actor" });
    }
    if (["22023", "22007", "22008"].includes(error.code ?? "")) {
      throw createError({ statusCode: 400, message: "Voice actor update is invalid" });
    }
    if (error.code === "P0002") {
      throw createError({ statusCode: 404, message: "Voice actor not found" });
    }
    if (["40001", "23505"].includes(error.code ?? "")) {
      throw createError({ statusCode: 409, message: "Voice actor changed or request conflicts" });
    }
    console.error(
      "Error in controlled voice actor update:",
      error.code ?? "unknown database error",
    );
    throw createError({ statusCode: 500, message: "Failed to update voice actor" });
  }

  if (
    !isRecord(data) ||
    !isRecord(data.record) ||
    !isJson(data.record) ||
    typeof data.record.updated_at !== "string"
  ) {
    throw createError({
      statusCode: 500,
      message: "Voice actor update returned an invalid response",
    });
  }

  return { profile: data.record };
});
