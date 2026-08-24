import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  try {
    const body = await readBody(event);
    const { bio, date_of_birth, nationality } = body;

    const supabase = event.context.supabaseAdmin || useSupabaseAdmin();

    const updateData: any = {};
    if (bio !== undefined) updateData.bio = bio;
    if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth;
    if (nationality !== undefined) updateData.nationality = nationality;
    updateData.updated_at = new Date().toISOString();
    updateData.user_id = user.id;

    const { data: profileData, error: profileError } = await supabase
      .from("user_profiles")
      .upsert(updateData, { onConflict: "user_id" })
      .select()
      .single();

    if (profileError) {
      console.error("Error updating user profile:", profileError);
      throw createError({
        statusCode: 500,
        message: "Failed to update user profile",
      });
    }

    return { profile: profileData };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error)
      throw error;
    console.error("Unexpected error:", error);
    throw createError({ statusCode: 500, message: "Internal server error" });
  }
});
