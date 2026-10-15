import { requireUser } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

function deleteError(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: message, message });
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}

function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isTimestamp(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
}

function mapRpcError(code: string): never {
  if (code === "42501" || code === "28000") {
    throw deleteError(403, "Work deletion is not authorized");
  }
  if (code === "P0002") {
    throw deleteError(404, "Work not found");
  }
  if (["55000", "23505", "40001", "40P01", "23503"].includes(code)) {
    throw deleteError(409, "Work changed, has dependent records, or the request id was reused");
  }
  if (["22023", "22P02", "22003"].includes(code)) {
    throw deleteError(422, "Voice actor work deletion fields are invalid");
  }
  console.error("Controlled voice actor work deletion failed", { code });
  throw deleteError(500, "Work deletion failed; no changes were saved");
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const body: unknown = await readBody(event);
  if (!isRecord(body)) {
    throw deleteError(400, "Invalid voice actor work deletion request");
  }
  if ("targetUserId" in body) {
    throw deleteError(403, "Acting user is taken from the authenticated session");
  }
  if (
    Object.keys(body).some((key) => !["request_id", "id", "expected_updated_at"].includes(key)) ||
    !isUuid(body.request_id) ||
    !isPositiveId(body.id) ||
    !isTimestamp(body.expected_updated_at)
  ) {
    throw deleteError(400, "Voice actor work deletion fields are invalid");
  }

  const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);
  const { data: result, error } = await supabase.rpc("delete_voice_actor_work_link", {
    p_user_id: user.id,
    p_request_id: body.request_id,
    p_work_id: body.id,
    p_expected_updated_at: body.expected_updated_at,
  });
  if (error) mapRpcError(error.code);
  const mutation = result?.[0];
  if (!mutation) {
    throw deleteError(500, "Work deletion failed; no changes were saved");
  }

  return {
    success: true,
    message: "Voice actor link deleted successfully",
    auditLogId: mutation.audit_log_id,
    replayed: mutation.replayed,
  };
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
