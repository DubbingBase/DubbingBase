import { isRecord } from "@app/shared-logic";
import { defineUserHandler } from "../utils/auth-handlers";
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
