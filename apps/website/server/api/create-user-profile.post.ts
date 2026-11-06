import { isRecord } from "@app/shared-logic";
import { defineUserHandler } from "../utils/auth-handlers";
import { useSupabaseAdmin } from "../utils/db/client";
import {
  maxBioLength,
  maxNationalityLength,
  parseOptionalDate,
  parseOptionalText,
} from "../utils/profile-validation";

export default defineUserHandler(async (event, user) => {
  try {
    const body: unknown = await readBody(event);
    if (!isRecord(body)) {
      throw createError({ statusCode: 400, message: "Invalid user profile" });
    }
    const bio = parseOptionalText(body.bio, "bio", maxBioLength);
    const dateOfBirth = parseOptionalDate(body.date_of_birth);
    const nationality = parseOptionalText(body.nationality, "nationality", maxNationalityLength);

    const supabaseAdmin = useSupabaseAdmin();

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("user_profiles")
      .insert({
        user_id: user.id,
        bio: bio || null,
        date_of_birth: dateOfBirth || null,
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
    if (error && typeof error === "object" && "statusCode" in error) throw error;
    console.error("Unexpected error in create-user-profile:", error);
    throw createError({ statusCode: 500, message: "Internal server error" });
  }
});
