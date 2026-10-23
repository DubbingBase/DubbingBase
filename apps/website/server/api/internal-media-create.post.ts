import { requireAdmin } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";
import { requireDubbingLanguage } from "../utils/dubbing-language";

function internalMediaError(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: message, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
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
      "product_line",
      "release_year",
      "cover_url",
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
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) ||
    !optionalText(body.brand) ||
    !optionalText(body.manufacturer) ||
    !optionalText(body.product_line) ||
    !optionalText(body.cover_url) ||
    !optionalText(body.description) ||
    (body.release_year !== undefined &&
      body.release_year !== null &&
      (typeof body.release_year !== "number" ||
        !Number.isSafeInteger(body.release_year) ||
        body.release_year < 1800 ||
        body.release_year > 2200)) ||
    (body.media_type === "advertisement" &&
      (body.product_line != null || body.release_year != null || body.cover_url != null)) ||
    (typeof body.cover_url === "string" &&
      body.cover_url.length > 0 &&
      !isSafeCoverUrl(body.cover_url))
  ) {
    throw internalMediaError(400, "Internal media fields are invalid");
  }

  const language = requireDubbingLanguage(body.dubbing_language);
  const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);
  const { data, error } = await supabase.rpc("create_internal_dubbing_project_with_metadata", {
    p_actor_id: user.id,
    p_request_id: requestId,
    p_media_type: mediaType,
    p_language: language,
    p_name: name,
    p_brand: body.brand ?? null,
    p_manufacturer: body.manufacturer ?? null,
    p_product_line: body.product_line ?? null,
    p_release_year: body.release_year ?? null,
    p_cover_url: body.cover_url ?? null,
    p_description: body.description ?? null,
  });

  if (error) {
    if (error.code === "42501") {
      throw internalMediaError(403, "Internal media creation is not authorized");
    }
    if (["55000", "23505", "40001"].includes(error.code)) {
      throw internalMediaError(409, "This internal media request is stale or was reused");
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
    project: {
      id: project.project_id,
      updated_at: project.updated_at,
      metadata_updated_at: project.metadata_updated_at,
    },
    auditLogId: project.audit_log_id,
    replayed: project.replayed,
  };
});

function isSafeCoverUrl(value: string): boolean {
  if (value.length > 2048) return false;

  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      !/[?&](access[_-]?token|refresh[_-]?token|id[_-]?token|token|api[_-]?key|apikey|client[_-]?secret|secret|password|passwd|authorization)=/i.test(
        url.search,
      )
    );
  } catch {
    return false;
  }
}
