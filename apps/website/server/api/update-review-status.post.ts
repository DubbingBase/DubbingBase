import { useSupabaseAdmin } from "../utils/db/client";
import { scheduleBackgroundTask } from "../utils/background";
import { notifyVoiceActorFollowers } from "../utils/notifications/fcm";
import { publishedContentLink } from "../utils/notifications/published-content-link";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  try {
    const body = await readBody(event);
    const { work_id, reviewed_status } = body;

    if (!work_id || !reviewed_status) {
      throw createError({
        statusCode: 400,
        message: "work_id and reviewed_status are required",
      });
    }

    const validStatuses = ["waiting", "accepted", "rejected"];
    if (!validStatuses.includes(reviewed_status)) {
      throw createError({
        statusCode: 400,
        message: "Invalid reviewed_status value",
      });
    }

    const isAdmin = user.app_metadata?.role === "admin";

    let canUpdate = isAdmin;

    const supabaseAdmin = event.context.supabaseAdmin || useSupabaseAdmin();

    const { data: before, error: beforeError } = await supabaseAdmin
      .from("work")
      .select("voice_actor_id, reviewed_status, status, dubbing_project_id")
      .eq("id", work_id)
      .maybeSingle();
    if (beforeError || !before) {
      throw createError({ statusCode: 404, message: "Work not found" });
    }

    if (!canUpdate) {
      const { data: userVoiceActor } = await supabaseAdmin
        .from("user_voice_actor_links")
        .select("voice_actor_id")
        .eq("user_id", user.id)
        .eq("voice_actor_id", before.voice_actor_id!)
        .single();

      canUpdate = !!userVoiceActor;
    }

    if (!canUpdate) {
      throw createError({
        statusCode: 403,
        message: "Insufficient permissions",
      });
    }

    let updateQuery = supabaseAdmin
      .from("work")
      .update({ reviewed_status })
      .eq("id", work_id);
    if (reviewed_status === "accepted") {
      updateQuery = updateQuery.or("reviewed_status.is.null,reviewed_status.neq.accepted");
    }
    const { data, error } = await updateQuery
      .select("*, dubbing_projects(*)")
      .maybeSingle();

    if (error) {
      console.error("Error updating review status:", error);
      throw createError({
        statusCode: 500,
        message: "Failed to update review status",
      });
    }

    if (
      data &&
      reviewed_status === "accepted" &&
      before.reviewed_status !== "accepted" &&
      before.status !== "validated" &&
      data.voice_actor_id &&
      data.dubbing_project_id
    ) {
      scheduleBackgroundTask(
        event,
        async () => {
          const { data: project, error: projectError } = await supabaseAdmin
            .from("dubbing_projects")
            .select("content_id, content_type, status")
            .eq("id", data.dubbing_project_id)
            .maybeSingle();
          if (projectError || !project || project.status !== "validated") return;
          const link = publishedContentLink(project.content_type, project.content_id);
          if (!link) return;
          await notifyVoiceActorFollowers(data.voice_actor_id, {
            title: "Voice role published",
            body: "A newly reviewed voice role is now published.",
            link,
            eventId: `review-${work_id}`,
          });
        },
        "voice-actor-fcm",
      );
    }

    return { success: true, data: data ?? before };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error)
      throw error;
    console.error("Error in update-review-status:", error);
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});
