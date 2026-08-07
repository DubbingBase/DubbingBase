import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    try {
      const user = ctx.userClaims;
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (req.method !== "POST") {
        return Response.json({ error: "Method not allowed" }, { status: 405 });
      }

      // Handle multipart form data for file uploads
      const contentType = req.headers.get("content-type") || "";
      if (!contentType.includes("multipart/form-data")) {
        return Response.json(
          { error: "Content type must be multipart/form-data" },
          { status: 400 },
        );
      }

      const formData = await req.formData();
      const category = formData.get("category")?.toString();
      const entityId = formData.get("entityId")?.toString();

      if (!category || !entityId) {
        return Response.json(
          { error: "Missing category or entityId" },
          { status: 400 },
        );
      }

      const supabaseAdmin = ctx.supabaseAdmin;
      let pointsAwarded = 0;
      let action = "";
      let entityType = "";
      let previousValue = null;
      let newValue = null;

      if (category === "missing_va_image") {
        entityType = "voice_actor";
        action = "added_profile_picture";
        pointsAwarded = 10;

        const file = formData.get("file") as File | null;
        if (!file) {
          return Response.json({ error: "Missing file" }, { status: 400 });
        }

        // Fetch previous value
        const { data: va } = await supabaseAdmin
          .from("voice_actors")
          .select("profile_picture")
          .eq("id", parseInt(entityId, 10))
          .single();

        if (!va)
          return Response.json(
            { error: "Voice actor not found" },
            { status: 404 },
          );
        if (va.profile_picture) {
          return Response.json(
            { error: "Voice actor already has a profile picture" },
            { status: 400 },
          );
        }
        previousValue = va.profile_picture;

        // Upload to voice_actor_profile_pictures bucket
        const fileExt = file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${entityId}/${fileName}`; // Assuming structure is {id}/filename

        const { error: uploadError, data: uploadData } =
          await supabaseAdmin.storage
            .from("voice_actor_profile_pictures")
            .upload(filePath, file, { contentType: file.type });

        if (uploadError) {
          console.error("Upload error:", uploadError);
          return Response.json(
            { error: "Failed to upload image" },
            { status: 500 },
          );
        }

        newValue = uploadData.path;

        // Update Voice Actor
        await supabaseAdmin
          .from("voice_actors")
          .update({ profile_picture: newValue, updated_by: user.id })
          .eq("id", parseInt(entityId, 10));
      } else if (category === "missing_studio_logo") {
        // Similar implementation for studio logos
        return Response.json({ error: "Not implemented yet" }, { status: 501 });
      } else {
        return Response.json({ error: "Invalid category" }, { status: 400 });
      }

      // Record in audit_logs
      const { error: auditError } = await supabaseAdmin
        .from("audit_logs")
        .insert({
          user_id: user.id,
          entity_type: entityType,
          entity_id: entityId,
          action: action,
          previous_value: previousValue ? { value: previousValue } : null,
          new_value: { value: newValue },
          points_awarded: pointsAwarded,
        });

      if (auditError) {
        console.error("Failed to insert audit log:", auditError);
        // We don't fail the request if audit logging fails, but it's bad
      }

      // Unlock task
      await supabaseAdmin
        .from("gamification_task_locks")
        .delete()
        .eq("category", category)
        .eq("entity_id", entityId);

      return Response.json({ success: true, pointsAwarded });
    } catch (error) {
      console.error("Unexpected error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }),
};
