import { requireUser } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

const PERFORMANCES = [
  "dialogues",
  "chant",
  "dialogues & chant",
  "bruitages",
  "narration",
  "ambiances",
  "voice",
] as const;

function updateError(statusCode: number, message: string) {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimestamp(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
}

function isPerformance(value: unknown): value is (typeof PERFORMANCES)[number] {
  return PERFORMANCES.some((performance) => performance === value);
}

function mapRpcError(code: string): never {
  if (code === "42501" || code === "28000") {
    throw updateError(403, "Work performance update is not authorized");
  }
  if (code === "P0002") {
    throw updateError(404, "Work not found");
  }
  if (["55000", "23505", "40001", "40P01"].includes(code)) {
    throw updateError(409, "Work changed or the request id was reused; reload and retry");
  }
  if (["22023", "23503", "22P02", "22003"].includes(code)) {
    throw updateError(422, "Voice actor performance value is invalid");
  }
  console.error("Controlled voice actor performance update failed", { code });
  throw updateError(500, "Performance update failed; no changes were saved");
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const body: unknown = await readBody(event);
  if (!isRecord(body)) {
    throw updateError(400, "Invalid voice actor performance request");
  }
  if ("targetUserId" in body) {
    throw updateError(403, "Acting user is taken from the authenticated session");
  }
  if (
    Object.keys(body).some(
      (key) => !["request_id", "work_id", "expected_updated_at", "performance"].includes(key),
    ) ||
    !isUuid(body.request_id) ||
    !isPositiveId(body.work_id) ||
    !isTimestamp(body.expected_updated_at) ||
    !isPerformance(body.performance)
  ) {
    throw updateError(400, "Voice actor performance fields are invalid");
  }

  const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);
  const { data: result, error } = await supabase.rpc("update_voice_actor_work_performance", {
    p_user_id: user.id,
    p_request_id: body.request_id,
    p_work_id: body.work_id,
    p_expected_updated_at: body.expected_updated_at,
    p_performance: body.performance,
  });
  if (error) mapRpcError(error.code);
  const mutation = result?.[0];
  if (!mutation) {
    throw updateError(500, "Performance update failed; no changes were saved");
  }

  const { data: work, error: workError } = await supabase
    .from("work")
    .select("*")
    .eq("id", mutation.work_id)
    .single();
  if (workError || !work) {
    console.error("Controlled work performance update committed but result could not be loaded", {
      code: workError?.code,
    });
    throw updateError(500, "Performance was saved but could not be loaded; retry safely");
  }
  return { ...work, auditLogId: mutation.audit_log_id, replayed: mutation.replayed };
});
