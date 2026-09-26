import { isDubbingLanguage, type DubbingLanguage } from "@app/shared-logic";

export interface PrepareGameRequestBody {
  igdbId: number;
  wikipedia_language: string;
  dubbing_language: DubbingLanguage;
}

export function buildPrepareGameRequest(
  igdbId: unknown,
  wikipediaLanguage: unknown,
  dubbingLanguage: unknown,
): PrepareGameRequestBody | null {
  if (
    typeof igdbId !== "number" ||
    !Number.isSafeInteger(igdbId) ||
    igdbId <= 0 ||
    typeof wikipediaLanguage !== "string" ||
    !/^[a-z][a-z0-9-]*$/.test(wikipediaLanguage) ||
    !isDubbingLanguage(dubbingLanguage)
  ) {
    return null;
  }

  return {
    igdbId,
    wikipedia_language: wikipediaLanguage,
    dubbing_language: dubbingLanguage,
  };
}
