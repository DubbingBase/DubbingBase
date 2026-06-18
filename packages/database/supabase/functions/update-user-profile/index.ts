import { withSupabase } from "npm:@supabase/server@^1";
import { Database } from "../_shared/database.types.ts";

type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    if (
      req.method !== "POST" &&
      req.method !== "PUT" &&
      req.method !== "PATCH"
    ) {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }

    try {
      const user = ctx.userClaims;
      if (!user) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Parse request body
      const body = await req.json();
      const { bio, date_of_birth, nationality } = body;

      // Update user profile directly
      const updateData: any = {};
      if (bio !== undefined) updateData.bio = bio;
      if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth;
      if (nationality !== undefined) updateData.nationality = nationality;
      updateData.updated_at = new Date().toISOString();
      updateData.user_id = user.id;

      const { data: profileData, error: profileError } = await ctx.supabase
        .from("user_profiles")
        .upsert(updateData, { onConflict: "user_id" })
        .select()
        .single();

      if (profileError) {
        console.error("Error updating user profile:", profileError);
        return Response.json(
          { error: "Failed to update user profile" },
          { status: 500 },
        );
      }

      return Response.json({ profile: profileData });
    } catch (error) {
      console.error("Unexpected error:", error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  }),
};
