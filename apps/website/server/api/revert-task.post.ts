import type { Json } from "@app/supabase";

function getAuditValue(value: Json | null): Json | null {
  if (value !== null && typeof value === "object" && !Array.isArray(value) && "value" in value) {
    return value.value ?? null;
  }
  return null;
}

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  try {
    const body = await readBody(event);
    const { auditLogId, resolvedValue, force } = body;

    if (!auditLogId) {
      throw createError({
        statusCode: 400,
        message: "Missing auditLogId",
      });
    }

    const supabaseAdmin = event.context.supabaseAdmin;

    const { data: auditLog, error: fetchError } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .eq("id", auditLogId)
      .single();

    if (fetchError || !auditLog) {
      throw createError({
        statusCode: 404,
        message: "Audit log not found",
      });
    }

    if (auditLog.entity_type === "voice_actor" && user.app_metadata?.role !== "admin") {
      throw createError({
        statusCode: 403,
        message: "Only admins can modify a voice actor profile picture",
      });
    }

    if (auditLog.reverted_at) {
      throw createError({ statusCode: 400, message: "Already reverted" });
    }

    let currentDbValue = null;
    if (auditLog.entity_type === "voice_actor") {
      const { data: currentEntity } = await supabaseAdmin
        .from("voice_actors")
        .select("profile_picture")
        .eq("id", parseInt(auditLog.entity_id, 10))
        .single();
      if (currentEntity) {
        currentDbValue = currentEntity.profile_picture;
      }
    }

    const expectedNewValue = getAuditValue(auditLog.new_value);

    if (currentDbValue !== expectedNewValue && !force) {
      throw createError({
        statusCode: 409,
        message:
          "ERR_STATE_CHANGED: The current value in the database has changed since this edit. Please verify.",
      });
    }

    const finalValue =
      resolvedValue !== undefined ? resolvedValue : getAuditValue(auditLog.previous_value);

    if (auditLog.entity_type === "voice_actor") {
      await supabaseAdmin
        .from("voice_actors")
        .update({ profile_picture: finalValue })
        .eq("id", parseInt(auditLog.entity_id, 10));
    }

    await supabaseAdmin
      .from("audit_logs")
      .update({ reverted_at: new Date().toISOString() })
      .eq("id", auditLogId);

    await supabaseAdmin.from("audit_logs").insert({
      user_id: auditLog.user_id,
      entity_type: "penalty",
      entity_id: auditLogId,
      action: "reverted_contribution",
      points_awarded: -(auditLog.points_awarded || 0),
    });

    return { success: true };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("Unexpected error:", error);
    throw createError({ statusCode: 500, message: "Internal server error" });
  }
});
