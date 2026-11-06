import { resolveUser } from "../utils/auth";
import { isRecord, type TablesInsert } from "@app/shared-logic";
import { useSupabaseAdmin } from "../utils/db/client";
import {
  maxBioLength,
  maxNationalityLength,
  parseOptionalDate,
  parseOptionalText,
} from "../utils/profile-validation";

export default defineEventHandler(async (event) => {
  const user = await resolveUser(event);
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  try {
    const body: unknown = await readBody(event);
    if (!isRecord(body)) {
      throw createError({ statusCode: 400, message: "Invalid user profile" });
    }
    const bio = parseOptionalText(body.bio, "bio", maxBioLength);
    const dateOfBirth = parseOptionalDate(body.date_of_birth);
    const nationality = parseOptionalText(body.nationality, "nationality", maxNationalityLength);

    const supabase = event.context.supabaseAdmin || useSupabaseAdmin();

    const updateData: TablesInsert<"user_profiles"> = {
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };
    if (bio !== undefined) updateData.bio = bio;
    if (dateOfBirth !== undefined) updateData.date_of_birth = dateOfBirth;
    if (nationality !== undefined) updateData.nationality = nationality;

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
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("Unexpected error:", error);
    throw createError({ statusCode: 500, message: "Internal server error" });
  }
});
