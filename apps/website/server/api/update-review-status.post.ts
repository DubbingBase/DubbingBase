import { requireUser } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function parseWorkId(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return value;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function updateError(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: message, message });
}

function mapRpcError(code: string): never {
  if (code === "42501" || code === "28000") {
    throw updateError(403, "Review status update is not authorized");
  }
  if (code === "P0002") throw updateError(404, "Work not found");
  if (["40001", "23505", "55000", "40P01"].includes(code)) {
    throw updateError(409, "Work changed or the request id was reused; reload and retry");
  }
  if (["22023", "22P02", "22003"].includes(code)) {
    throw updateError(400, "Review status update fields are invalid");
  }
  console.error("Controlled work review status update failed", { code });
  throw updateError(500, "Review status update failed; no changes were saved");
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const body: unknown = await readBody(event);
  if (!isRecord(body)) throw updateError(400, "Invalid review status update request");
  if ("targetUserId" in body || "user_id" in body || "actor_id" in body) {
    throw updateError(403, "Acting user is taken from the authenticated session");
  }

  const allowedKeys = ["work_id", "reviewed_status", "expected_updated_at", "request_id"];
  if (Object.keys(body).some((key) => !allowedKeys.includes(key))) {
    throw updateError(400, "Review status update contains a protected or unknown field");
  }

  const workId = parseWorkId(body.work_id);
  if (workId === null) throw updateError(400, "work_id must be a positive integer");
  if (
    body.reviewed_status !== "waiting" &&
    body.reviewed_status !== "accepted" &&
    body.reviewed_status !== "rejected"
  ) {
    throw updateError(400, "Invalid reviewed_status value");
  }
  const reviewedStatus = body.reviewed_status;

  const requestId = body.request_id;
  if (requestId !== undefined && !isUuid(requestId)) {
    throw updateError(400, "request_id must be a UUID");
  }

  const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);
  let expectedUpdatedAt: string;
  if (body.expected_updated_at === undefined) {
    // Compatibility for callers without a loaded version only protects the
    // read-to-write race here. Editors must send expected_updated_at to detect
    // that their snapshot was already stale before this request began.
    const { data: version, error: versionError } = await supabase
      .from("work")
      .select("updated_at")
      .eq("id", workId)
      .maybeSingle();
    if (versionError) {
      console.error("Unable to read work version for review status update", {
        code: versionError.code,
      });
      throw updateError(500, "Review status update failed; no changes were saved");
    }
    if (!version) throw updateError(404, "Work not found");
    expectedUpdatedAt = version.updated_at;
  } else if (isTimestamp(body.expected_updated_at)) {
    expectedUpdatedAt = body.expected_updated_at;
  } else {
    throw updateError(400, "expected_updated_at must be a valid timestamp");
  }

  const { data: result, error } = await supabase.rpc("update_work_review_status_controlled", {
    p_actor_id: user.id,
    p_request_id: requestId ?? null,
    p_work_id: workId,
    p_expected_updated_at: expectedUpdatedAt,
    p_reviewed_status: reviewedStatus,
  });
  if (error) mapRpcError(error.code);

  const mutation = result?.[0];
  if (!mutation) {
    throw updateError(500, "Review status update failed; no changes were saved");
  }

  const { data, error: readError } = await supabase
    .from("work")
    .select("*, dubbing_projects(*)")
    .eq("id", mutation.work_id)
    .single();
  if (readError || !data) {
    console.error("Controlled work review status update result could not be loaded", {
      code: readError?.code,
    });
    throw updateError(
      500,
      "Review status was saved but the result could not be loaded; retry safely",
    );
  }

  return {
    success: true,
    data,
    audit_log_id: mutation.audit_log_id,
    replayed: mutation.replayed,
  };
});
