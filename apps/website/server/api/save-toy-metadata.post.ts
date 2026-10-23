import type { Json, Database } from "@app/supabase/types";
import type { Toy, ToyMetadataInput, ToyMetadataSaveResponse } from "@app/shared-logic";
import { requireAdmin } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

type ToyMetadataRow = Database["public"]["Tables"]["toy_metadata"]["Row"];

function metadataError(statusCode: number, message: string): never {
  throw createError({ statusCode, statusMessage: message, message });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function isTimestamp(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
}

function isOptionalText(value: unknown, maxLength: number): value is string | null {
  return value === null || (typeof value === "string" && value.length <= maxLength);
}

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

function isToyMetadataInput(value: unknown): value is ToyMetadataInput {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "name",
      "manufacturer",
      "product_line",
      "release_year",
      "cover_url",
      "description",
    ]) ||
    Object.keys(value).length !== 6 ||
    typeof value.name !== "string" ||
    value.name.trim().length < 1 ||
    value.name.trim().length > 300 ||
    !isOptionalText(value.manufacturer, 300) ||
    !isOptionalText(value.product_line, 300) ||
    !isOptionalText(value.description, 10000) ||
    !isOptionalText(value.cover_url, 2048) ||
    (value.release_year !== null &&
      (typeof value.release_year !== "number" ||
        !Number.isSafeInteger(value.release_year) ||
        value.release_year < 1800 ||
        value.release_year > 2200))
  ) {
    return false;
  }

  return (
    value.cover_url === null || value.cover_url.trim() === "" || isSafeCoverUrl(value.cover_url)
  );
}

function isToyMetadataRow(value: unknown): value is ToyMetadataRow {
  return (
    isRecord(value) &&
    typeof value.content_id === "number" &&
    Number.isSafeInteger(value.content_id) &&
    value.content_id !== 0 &&
    typeof value.name === "string" &&
    (typeof value.manufacturer === "string" || value.manufacturer === null) &&
    (typeof value.product_line === "string" || value.product_line === null) &&
    (typeof value.release_year === "number" || value.release_year === null) &&
    (typeof value.cover_url === "string" || value.cover_url === null) &&
    (typeof value.description === "string" || value.description === null) &&
    (typeof value.created_by === "string" || value.created_by === null) &&
    (typeof value.updated_by === "string" || value.updated_by === null) &&
    typeof value.created_at === "string" &&
    typeof value.updated_at === "string"
  );
}

function mapToy(row: ToyMetadataRow): Toy {
  return {
    id: row.content_id,
    name: row.name,
    manufacturer: row.manufacturer,
    ...(row.product_line === null ? {} : { product_line: row.product_line }),
    ...(row.release_year === null ? {} : { release_year: row.release_year }),
    cover_url: row.cover_url,
    description: row.description,
    updated_at: row.updated_at,
    media_type: "toy",
  };
}

export default defineEventHandler(async (event): Promise<ToyMetadataSaveResponse> => {
  const user = requireAdmin(event);
  const body: unknown = await readBody(event);

  if (
    !isRecord(body) ||
    !hasOnlyKeys(body, ["request_id", "content_id", "expected_updated_at", "metadata"]) ||
    Object.keys(body).length !== 4 ||
    !isUuid(body.request_id) ||
    typeof body.content_id !== "number" ||
    !Number.isSafeInteger(body.content_id) ||
    body.content_id === 0 ||
    !isTimestamp(body.expected_updated_at) ||
    !isToyMetadataInput(body.metadata)
  ) {
    metadataError(400, "Toy metadata fields are invalid");
  }

  const metadata: ToyMetadataInput = {
    name: body.metadata.name.trim(),
    manufacturer: body.metadata.manufacturer?.trim() || null,
    product_line: body.metadata.product_line?.trim() || null,
    release_year: body.metadata.release_year,
    cover_url: body.metadata.cover_url?.trim() || null,
    description: body.metadata.description?.trim() || null,
  };
  const payload: Json = {
    name: metadata.name,
    manufacturer: metadata.manufacturer,
    product_line: metadata.product_line,
    release_year: metadata.release_year,
    cover_url: metadata.cover_url,
    description: metadata.description,
  };

  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase.rpc("controlled_save_toy_metadata", {
    p_actor_id: user.id,
    p_request_id: body.request_id,
    p_content_id: body.content_id,
    p_expected_updated_at: body.expected_updated_at,
    p_payload: payload,
  });

  if (error) {
    if (error.code === "42501") {
      metadataError(403, "Only administrators can save toy metadata");
    }
    if (error.code === "22023") {
      metadataError(400, "Toy metadata fields are invalid");
    }
    if (error.code === "55000" || error.code === "23505") {
      metadataError(409, "Toy metadata changed or the request was reused");
    }
    console.error("Toy metadata save failed", { code: error.code ?? "unknown database error" });
    metadataError(500, "Failed to save toy metadata");
  }

  if (
    !isRecord(data) ||
    !isToyMetadataRow(data.record) ||
    typeof data.audit_log_id !== "string" ||
    typeof data.replayed !== "boolean"
  ) {
    metadataError(500, "Toy metadata save returned an invalid response");
  }

  return {
    toy: mapToy(data.record),
    auditLogId: data.audit_log_id,
    replayed: data.replayed,
  };
});
