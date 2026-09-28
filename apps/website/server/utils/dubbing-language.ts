import { isDubbingLanguage, type DubbingLanguage } from "@app/shared-logic";

export function requireDubbingLanguage(value: unknown): DubbingLanguage {
  if (!isDubbingLanguage(value)) {
    throw createError({
      statusCode: 400,
      message:
        "An approved regional dubbing language is required (for example fr-FR or de-DE)",
    });
  }
  return value;
}
