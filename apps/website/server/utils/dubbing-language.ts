import { isDubbingLanguage, type DubbingLanguage } from "@app/shared-logic";

export function requireDubbingLanguage(value: unknown): DubbingLanguage {
  if (!isDubbingLanguage(value)) {
    throw createError({
      statusCode: 400,
      message: "A regional dubbing language is required (for example fr-FR)",
    });
  }
  return value;
}
