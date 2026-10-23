import { requireAdmin } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";
import { requireDubbingLanguage } from "../utils/dubbing-language";

function internalMediaError(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: message, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export default defineEventHandler(async (event) => {
  const user = requireAdmin(event);
  const body: unknown = await readBody(event);
  if (
    !isRecord(body) ||
    !hasOnlyKeys(body, [
      "request_id",
      "media_type",
      "name",
      "brand",
      "manufacturer",
      "description",
      "dubbing_language",
    ])
  ) {
    throw internalMediaError(400, "Invalid internal media request");
  }

  const mediaType = body.media_type;
  const name = body.name;
  const requestId = body.request_id;
  if (
    (mediaType !== "advertisement" && mediaType !== "toy") ||
    typeof name !== "string" ||
    name.trim().length === 0 ||
    name.length > 300 ||
    typeof requestId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      requestId,
    ) ||
    !optionalText(body.brand) ||
    !optionalText(body.manufacturer) ||
    !optionalText(body.description)
  ) {
    throw internalMediaError(400, "Internal media fields are invalid");
  }

  const language = requireDubbingLanguage(body.dubbing_language);
  const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);
  const { data, error } = await supabase.rpc(
    "create_internal_dubbing_project",
    {
      p_actor_id: user.id,
      p_request_id: requestId,
      p_media_type: mediaType,
      p_language: language,
      p_name: name,
      p_brand: body.brand ?? null,
      p_manufacturer: body.manufacturer ?? null,
      p_description: body.description ?? null,
    },
  );

  if (error) {
    if (error.code === "42501") {
      throw internalMediaError(
        403,
        "Internal media creation is not authorized",
      );
    }
    if (["55000", "23505", "40001"].includes(error.code)) {
      throw internalMediaError(
        409,
        "This internal media request is stale or was reused",
      );
    }
    if (["22023", "23503", "22P02", "22003"].includes(error.code)) {
      throw internalMediaError(422, "Internal media fields are invalid");
    }
    console.error("Controlled internal media creation failed", {
      code: error.code,
    });
    throw internalMediaError(500, "Internal media creation failed");
  }

  const project = data?.[0];
  if (!project) {
    throw internalMediaError(500, "Internal media creation failed");
  }

  return {
    media: {
      id: project.content_id,
      content_id: project.content_id,
      project_id: project.project_id,
      title: name,
      name,
      media_type: mediaType,
      brand: body.brand ?? null,
      manufacturer: body.manufacturer ?? null,
      description: body.description ?? null,
    },
    auditLogId: project.audit_log_id,
    replayed: project.replayed,
  };
});
