import { defineAdminHandler } from "../utils/auth-handlers";
import { useSupabaseAdmin } from "../utils/db/client";
import { isJson, isRecord } from "@app/shared-logic";

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

function badRequest(message: string): never {
  throw createError({ statusCode: 400, message });
}

export default defineAdminHandler(async (event, user) => {
  const body: unknown = await readBody(event);

  if (!isRecord(body) || !isRecord(body.payload) || !isJson(body.payload)) {
    badRequest("A valid metadata payload is required");
  }
  if (Object.keys(body).some((key) => !["type", "payload", "request_id"].includes(key))) {
    badRequest("Request contains a protected or unknown field");
  }

  if (body.type !== "job" && body.type !== "voice_actor") {
    badRequest("Invalid type parameter");
  }

  const type = body.type;
  const payload = body.payload;
  const allowedFields = type === "job" ? new Set(["name"]) : voiceActorFields;
  if (Object.keys(payload).some((key) => !allowedFields.has(key))) {
    badRequest("Metadata payload contains a protected or unknown field");
  }

  if (type === "job") {
    if (
      typeof payload.name !== "string" ||
      payload.name.trim().length < 1 ||
      payload.name.trim().length > 120
    ) {
      badRequest("Job name must contain 1 to 120 characters");
    }
  } else if (
    typeof payload.firstname !== "string" ||
    payload.firstname.trim().length < 1 ||
    payload.firstname.trim().length > 120 ||
    typeof payload.lastname !== "string" ||
    payload.lastname.trim().length < 1 ||
    payload.lastname.trim().length > 120
  ) {
    badRequest("Voice actor first and last names are required");
  }

  const requestId = body.request_id;
  if (
    requestId !== undefined &&
    (typeof requestId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))
  ) {
    badRequest("request_id must be a UUID");
  }

  const supabase = useSupabaseAdmin();
  const rpcArgs = {
    p_actor_id: user.id,
    p_entity_type: type,
    p_payload: payload,
  };
  const { data, error } =
    requestId === undefined
      ? await supabase.rpc("controlled_save_metadata", rpcArgs)
      : await supabase.rpc("controlled_save_metadata", {
          ...rpcArgs,
          p_request_id: requestId,
        });

  if (error) {
    if (error.code === "42501") {
      throw createError({
        statusCode: 403,
        message: "Only administrators can save metadata",
      });
    }
    if (error.code === "22023") {
      throw createError({
        statusCode: 400,
        message: "Metadata payload is invalid",
      });
    }
    if (error.code === "23505") {
      throw createError({
        statusCode: 409,
        message: "Metadata record already exists or request conflicts",
      });
    }
    console.error("Error in save-metadata RPC:", error.code ?? "unknown database error");
    throw createError({ statusCode: 500, message: "Failed to save metadata" });
  }

  if (!isRecord(data) || !Object.hasOwn(data, "record") || !isJson(data.record)) {
    throw createError({
      statusCode: 500,
      message: "Metadata operation returned an invalid response",
    });
  }

  return { data: data.record };
});
