import { isDubbingLanguage } from "@app/shared-logic";

export type WikiCheckDisposition =
  "no_dubbing_sections" | "regional_review_required" | "enqueue_extract";

export function wikiCheckDisposition(
  hasDubbingSections: boolean,
  dubbingLanguage: unknown,
): WikiCheckDisposition {
  if (!hasDubbingSections) return "no_dubbing_sections";
  if (!isDubbingLanguage(dubbingLanguage)) return "regional_review_required";
  return "enqueue_extract";
}
