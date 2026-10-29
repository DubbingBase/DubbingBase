import { requireUser } from "../utils/auth";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function parseVoiceActorId(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function unlinkError(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: message, message });
}

function mapRpcError(code: string): never {
  if (code === "42501" || code === "28000") {
    throw unlinkError(403, "You can only remove your own voice-actor link");
  }
  if (code === "P2001" || code === "23505") {
    throw unlinkError(409, "The voice-actor link changed or the request ID was reused");
  }
  if (["22023", "22P02", "22003"].includes(code)) {
    throw unlinkError(400, "User voice-actor unlink fields are invalid");
  }
  console.error("Controlled user voice-actor unlink failed", { code });
  throw unlinkError(500, "Failed to unlink user from voice actor; no changes were saved");
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const body: unknown = await readBody(event);
  if (!isRecord(body)) throw unlinkError(400, "Invalid user voice-actor unlink request");
  const allowedKeys = [
    "request_id",
    "user_id",
    "targetUserId",
    "voice_actor_id",
    "expected_link_id",
  ];
  if (Object.keys(body).some((key) => !allowedKeys.includes(key))) {
    throw unlinkError(400, "User voice-actor unlink contains an unknown field");
  }
  if (
    body.user_id !== undefined &&
    body.targetUserId !== undefined &&
    body.user_id !== body.targetUserId
  ) {
    throw unlinkError(400, "user_id and targetUserId must match when both are supplied");
  }

  const targetUserId = body.user_id ?? body.targetUserId ?? user.id;
  const requestId = isUuid(body.request_id) ? body.request_id : null;
  const expectedLinkId = isUuid(body.expected_link_id) ? body.expected_link_id : null;
  const voiceActorId = parseVoiceActorId(body.voice_actor_id);
  if (!isUuid(targetUserId) || !requestId || !expectedLinkId || voiceActorId === null) {
    throw unlinkError(
      400,
      "A valid request_id, user_id, expected_link_id, and positive voice_actor_id are required",
    );
  }
  if (targetUserId !== user.id && user.app_metadata?.role !== "admin") {
    throw unlinkError(403, "Unauthorized: Admin access required to unlink another user");
  }

  const supabase = event.context.supabase;
  if (!supabase) throw unlinkError(500, "Authentication client is unavailable");

  const { data, error } = await supabase.rpc("delete_user_voice_actor_link_controlled", {
    p_actor_id: user.id,
    p_request_id: requestId,
    p_user_id: targetUserId,
    p_voice_actor_id: voiceActorId,
    p_expected_link_id: expectedLinkId,
  });
  if (error) mapRpcError(error.code);

  const result = data?.[0];
  if (!result) {
    throw unlinkError(500, "Failed to unlink user from voice actor; no changes were saved");
  }

  return {
    success: true,
    message: "User unlinked from voice actor successfully",
    removed: result.deleted,
    replayed: result.replayed,
    auditLogId: result.audit_log_id,
  };
});
