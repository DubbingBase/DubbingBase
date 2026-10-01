import { requireUser } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);

  try {
    const body = await readBody(event);
    const { bio, date_of_birth, nationality } = body;

    const supabaseAdmin = useSupabaseAdmin();

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .insert({
        user_id: user.id,
        bio: bio || null,
        date_of_birth: date_of_birth || null,
        nationality: nationality || null,
      })
      .select()
      .single();

    if (profileError) {
      console.error("Error creating user profile:", profileError);
      throw createError({
        statusCode: 500,
        message: "Failed to create user profile",
      });
    }

    return { profile: profileData };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error)
      throw error;
    console.error("Unexpected error in create-user-profile:", error);
    throw createError({ statusCode: 500, message: "Internal server error" });
  }
});
