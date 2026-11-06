import { resolveUser } from "../utils/auth";
import { isRecord, type TablesInsert } from "@app/shared-logic";
import { useSupabaseAdmin } from "../utils/db/client";

const maxBioLength = 5000;
const maxNationalityLength = 100;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function invalidField(field: string): never {
  throw createError({ statusCode: 400, message: `Invalid ${field}` });
}

function parseOptionalText(
  value: unknown,
  field: string,
  maxLength: number,
): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string" || value.length > maxLength) return invalidField(field);
  return value;
}

function parseOptionalDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !isoDatePattern.test(value)) {
    return invalidField("date_of_birth");
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return invalidField("date_of_birth");
  }
  return value;
}

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
