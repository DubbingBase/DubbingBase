import type { Json } from "@app/supabase";
import { requireUser } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

const editableFields = new Set([
  "name",
  "description",
  "country",
  "city",
  "website_url",
  "logo_url",
  "social_media_links",
]);
const socialMediaFields = new Set(["twitter", "instagram", "tiktok", "facebook"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalidRequest(): never {
  throw createError({ statusCode: 400, message: "Invalid studio update" });
}

function parseStudioId(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^[1-9]\d*$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return invalidRequest();
}

function parseHttpUrl(value: string, field: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return invalidRequest();
  }

  if (
    (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
    parsed.username.length > 0 ||
    parsed.password.length > 0 ||
    value.length > 2048
  ) {
    throw createError({ statusCode: 400, message: `Invalid ${field}` });
  }
  return value;
}

function parseNullableText(value: unknown, maxLength: number): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return invalidRequest();
  const normalized = value.trim();
  if (normalized.length > maxLength) return invalidRequest();
  return normalized.length > 0 ? normalized : null;
}

function parseUpdates(value: unknown): Record<string, Json> {
  if (!isRecord(value)) return invalidRequest();
  const entries = Object.entries(value);
  if (entries.length === 0 || entries.some(([field]) => !editableFields.has(field))) {
    return invalidRequest();
  }

  const updates: Record<string, Json> = {};
  for (const [field, rawValue] of entries) {
    if (field === "name") {
      const name = parseNullableText(rawValue, 200);
      if (name === null) return invalidRequest();
      updates.name = name;
    } else if (field === "description") {
      updates.description = parseNullableText(rawValue, 10_000);
    } else if (field === "country") {
      updates.country = parseNullableText(rawValue, 100);
    } else if (field === "city") {
      updates.city = parseNullableText(rawValue, 200);
    } else if (field === "website_url" || field === "logo_url") {
      const url = parseNullableText(rawValue, 2048);
      updates[field] = url === null ? null : parseHttpUrl(url, field);
    } else if (field === "social_media_links") {
      if (!isRecord(rawValue)) return invalidRequest();
      const socialLinks: Record<string, Json> = {};
      for (const [social, rawUrl] of Object.entries(rawValue)) {
        if (!socialMediaFields.has(social)) return invalidRequest();
        const url = parseNullableText(rawUrl, 2048);
        socialLinks[social] = url === null ? null : parseHttpUrl(url, social);
      }
      updates.social_media_links = socialLinks;
    }
  }
  return updates;
}

function parseRequestId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    return invalidRequest();
  }
  return value;
}

function parseExpectedUpdatedAt(value: unknown): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return invalidRequest();
  return value;
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const body: unknown = await readBody(event);
  if (!isRecord(body) || !Object.hasOwn(body, "id")) return invalidRequest();

  const studioId = parseStudioId(body.id);
  const updates = parseUpdates(body.updates);
  const requestId = parseRequestId(body.requestId);
  const expectedUpdatedAt =
    studioId === null ? null : parseExpectedUpdatedAt(body.expectedUpdatedAt);

  const { data, error } = await useSupabaseAdmin(event).rpc("controlled_save_studio", {
    p_actor_id: user.id,
    p_studio_id: studioId,
    p_expected_updated_at: expectedUpdatedAt,
    p_request_id: requestId,
    p_updates: updates,
  });

  if (error) {
    if (error.code === "42501") {
      throw createError({ statusCode: 403, message: "You cannot change this studio field" });
    }
    if (error.code === "P0002") {
      throw createError({ statusCode: 404, message: "Studio not found" });
    }
    if (error.code === "40001" || error.code === "23505") {
      throw createError({
        statusCode: 409,
        message: "Studio changed or already exists. Reload and try again.",
      });
    }
    if (error.code === "22023") {
      throw createError({ statusCode: 400, message: "Invalid studio update" });
    }
    console.error("Failed to save studio", { code: error.code });
    throw createError({ statusCode: 500, message: "Failed to save studio" });
  }

  const result = data?.[0];
  if (!result) {
    throw createError({ statusCode: 500, message: "Failed to save studio" });
  }

  return {
    success: true,
    studioId: result.studio_id,
    auditLogId: result.audit_log_id,
    replayed: result.replayed,
  };
});
