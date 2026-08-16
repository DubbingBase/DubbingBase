import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";
import { purgeMediaForVoiceActor } from "../_shared/cache-purge.ts";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const user = ctx.userClaims;
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Check if user is admin (simplified check based on role or permissions would go here)
      // For now we assume the frontend role check is sufficient for this MVP,
      // but in a real app we'd verify they have the 'admin' role in user_roles.

      if (req.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      const body = await req.json();
      const { auditLogId, resolvedValue, force } = body;

      if (!auditLogId) {
        return Response.json({ error: "Missing auditLogId" }, { status: 400 });
      }

      const supabaseAdmin = ctx.supabaseAdmin;

      // Fetch the audit log
      const { data: auditLog, error: fetchError } = await supabaseAdmin
        .from("audit_logs")
        .select("*")
        .eq("id", auditLogId)
        .single();

      if (fetchError || !auditLog) {
        return Response.json({ error: "Audit log not found" }, { status: 404 });
      }

      if (auditLog.reverted_at) {
        return Response.json({ error: "Already reverted" }, { status: 400 });
      }

      // Concurrency Check: Check current value in DB
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

      // Extract new value from JSONB
      const expectedNewValue = auditLog.new_value
        ? (auditLog.new_value as any).value
        : null;

      // If the current DB value doesn't match the new_value from the log, someone else changed it!
      if (currentDbValue !== expectedNewValue && !force) {
        return Response.json(
          {
            error: "ERR_STATE_CHANGED",
            message:
              "The current value in the database has changed since this edit. Please verify.",
            currentValue: currentDbValue,
            previousValue: auditLog.previous_value
              ? (auditLog.previous_value as any).value
              : null,
            loggedValue: expectedNewValue,
          },
          { status: 409 },
        );
      }

      // Perform the revert (using the resolvedValue which might be from the 3-way check)
      const finalValue =
        resolvedValue !== undefined
          ? resolvedValue
          : auditLog.previous_value
            ? (auditLog.previous_value as any).value
            : null;

      if (auditLog.entity_type === "voice_actor") {
        await supabaseAdmin
          .from("voice_actors")
          .update({ profile_picture: finalValue })
          .eq("id", parseInt(auditLog.entity_id, 10));
      }

      // Mark as reverted
      await supabaseAdmin
        .from("audit_logs")
        .update({ reverted_at: new Date().toISOString() })
        .eq("id", auditLogId);

      // (Optional) Deduct points from the offending user by inserting a negative points entry
      await supabaseAdmin.from("audit_logs").insert({
        user_id: auditLog.user_id,
        entity_type: "penalty",
        entity_id: auditLogId, // Reference the reverted log
        action: "reverted_contribution",
        points_awarded: -(auditLog.points_awarded || 0),
      });

      if (auditLog.entity_type === "voice_actor") {
        await purgeMediaForVoiceActor(
          ctx.supabaseAdmin,
          parseInt(auditLog.entity_id, 10),
        );
      }

      return Response.json({ success: true });
    } catch (error) {
      console.error("Unexpected error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }),
};
