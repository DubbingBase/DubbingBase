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

      const body = await req.json();
      const category = body.category;

      if (!category) {
        return Response.json({ error: "Missing category" }, { status: 400 });
      }

      let query;
      let tableName = "";

      // We will use service_role client to read all records and update locks
      const supabaseAdmin = ctx.supabaseAdmin;

      if (category === "missing_va_image") {
        tableName = "voice_actors";
        query = supabaseAdmin
          .from("voice_actors")
          .select("*")
          .is("profile_picture", null)
          .limit(10);
      } else if (category === "missing_studio_logo") {
        tableName = "studios";
        query = supabaseAdmin
          .from("studios")
          .select("*")
          .is("logo_url", null)
          .limit(10);
      } else {
        return Response.json({ error: "Invalid category" }, { status: 400 });
      }

      const { data: candidates, error } = await query;

      if (error) {
        console.error("Error fetching candidates:", error);
        return Response.json(
          { error: "Failed to fetch task" },
          { status: 500 },
        );
      }

      if (!candidates || candidates.length === 0) {
        return Response.json({
          task: null,
          message: "No tasks available in this category!",
        });
      }

      // Shuffle candidates randomly
      candidates.sort(() => 0.5 - Math.random());

      // Try to find one that isn't locked
      let selectedTask = null;
      for (const candidate of candidates) {
        const idStr = candidate.id.toString();
        // Check if locked
        const { data: lockData } = await supabaseAdmin
          .from("gamification_task_locks")
          .select("*")
          .eq("category", category)
          .eq("entity_id", idStr)
          .single();

        // If locked_at is less than 5 minutes ago, it's locked.
        if (lockData && lockData.locked_at) {
          const lockedAt = new Date(lockData.locked_at).getTime();
          const now = Date.now();
          if (now - lockedAt < 5 * 60 * 1000) {
            continue; // Locked, try next
          }
        }

        // We found an unlocked one! Lock it and break.
        await supabaseAdmin.from("gamification_task_locks").upsert({
          category,
          entity_id: idStr,
          locked_at: new Date().toISOString(),
        });

        selectedTask = candidate;
        break;
      }

      if (!selectedTask) {
        return Response.json({
          task: null,
          message:
            "All tasks are currently locked by other users, try again in a few minutes!",
        });
      }

      return Response.json({ task: selectedTask });
    } catch (error) {
      console.error("Unexpected error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }),
};
