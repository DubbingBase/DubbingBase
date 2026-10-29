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

function linkError(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: message, message });
}

function mapRpcError(code: string): never {
  if (code === "42501" || code === "28000") {
    throw linkError(403, "Only administrators can link a user to a voice actor");
  }
  if (code === "P0002") throw linkError(404, "User or voice actor not found");
  if (code === "P2001" || code === "23505") {
    throw linkError(409, "The user voice-actor link request conflicts with current data");
  }
  if (["22023", "22P02", "22003"].includes(code)) {
    throw linkError(400, "User or voice actor link fields are invalid");
  }
  console.error("Controlled user voice-actor link failed", { code });
  throw linkError(500, "Failed to link user to voice actor; no changes were saved");
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  if (user.app_metadata?.role !== "admin") {
    throw linkError(403, "Unauthorized: Admin access required");
  }

  const body: unknown = await readBody(event);
  if (!isRecord(body)) throw linkError(400, "Invalid user voice-actor link request");
  const allowedKeys = ["request_id", "user_id", "targetUserId", "voice_actor_id"];
  if (Object.keys(body).some((key) => !allowedKeys.includes(key))) {
    throw linkError(400, "User voice-actor link contains an unknown field");
  }
  if (
    body.user_id !== undefined &&
    body.targetUserId !== undefined &&
    body.user_id !== body.targetUserId
  ) {
    throw linkError(400, "user_id and targetUserId must match when both are supplied");
  }

  const targetUserId = body.user_id ?? body.targetUserId ?? user.id;
  const requestId = body.request_id;
  const voiceActorId = parseVoiceActorId(body.voice_actor_id);
  if (!isUuid(targetUserId) || !isUuid(requestId) || voiceActorId === null) {
    throw linkError(400, "A valid request_id, user_id, and positive voice_actor_id are required");
  }

  const supabase = event.context.supabase;
  if (!supabase) throw linkError(500, "Authentication client is unavailable");

  const { data, error } = await supabase.rpc("admin_link_user_voice_actor_controlled", {
    p_actor_id: user.id,
    p_request_id: requestId,
    p_user_id: targetUserId,
    p_voice_actor_id: voiceActorId,
  });
  if (error) mapRpcError(error.code);

  const result = data?.[0];
  if (!result) {
    throw linkError(500, "Failed to link user to voice actor; no changes were saved");
  }

  return {
    success: true,
    message: "User linked to voice actor successfully",
    alreadyLinked: !result.created,
    replayed: result.replayed,
    auditLogId: result.audit_log_id,
  };
});
