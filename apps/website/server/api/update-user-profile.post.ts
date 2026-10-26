import { useSupabaseAdmin } from "../utils/db/client";
import type { Database } from "@app/supabase";
import { z } from "zod";

const profileUpdateSchema = z.object({
  bio: z.string().nullable().optional(),
  date_of_birth: z.string().nullable().optional(),
  nationality: z.string().nullable().optional(),
});

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  try {
    const body = profileUpdateSchema.safeParse(await readBody(event));
    if (!body.success) {
      throw createError({ statusCode: 400, message: "Invalid profile fields" });
    }
    const { bio, date_of_birth, nationality } = body.data;

    const supabase = event.context.supabaseAdmin || useSupabaseAdmin();

    const updateData: Database["public"]["Tables"]["user_profiles"]["Insert"] = {
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };
    if (bio !== undefined) updateData.bio = bio;
    if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth;
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
