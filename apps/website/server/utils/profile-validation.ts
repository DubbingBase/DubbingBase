// Validation shared by the user profile create and update routes. Each parser returns the
// value to store (`undefined` meaning "not provided") or throws a 400 before any database call.

export const maxBioLength = 5000;
export const maxNationalityLength = 100;
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function invalidField(field: string): never {
  throw createError({ statusCode: 400, message: `Invalid ${field}` });
}

export function parseOptionalText(
  value: unknown,
  field: string,
  maxLength: number,
): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== "string" || value.length > maxLength) return invalidField(field);
  return value;
}

export function parseOptionalDate(value: unknown): string | null | undefined {
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
