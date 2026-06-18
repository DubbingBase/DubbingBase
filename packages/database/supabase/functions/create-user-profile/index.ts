import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Database } from "../_shared/database.types.ts";
import { withSupabase } from "npm:@supabase/server@^1";

type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];

export default {
  fetch: withSupabase<Database>({ auth: "user" }, async (req, ctx) => {
    if (req.method !== "POST") {
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

      // Insert user profile
      const { data: profileData, error: profileError } = await ctx.supabase
        .from("user_profiles")
        .insert({
          user_id: user.id,
          bio: bio || null,
          date_of_birth: date_of_birth || null,
        })
        .select()
        .single();

      if (profileError) {
        console.error("Error creating user profile:", profileError);
        return Response.json(
          { error: "Failed to create user profile" },
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
