import type { DubbingLanguage } from "@app/shared-logic";
import type { DubbingEvidence } from "./dubbing-region-detection";

export type WikiCheckDisposition =
  | { disposition: "no_dubbing_evidence" }
  | {
      disposition: "enqueue_extract";
      targets: Array<{
        dubbingLanguage: DubbingLanguage;
        sectionIndexes: number[];
      }>;
    }
  | { disposition: "regional_review_required"; reason: string }
  | { disposition: "target_conflict"; reason: string };

export function wikiCheckDisposition(
  evidence: DubbingEvidence,
  candidateSectionIndexes: number[],
  requestedLanguage?: DubbingLanguage,
): WikiCheckDisposition {
  if (evidence.kind === "none") {
    if (!requestedLanguage) return { disposition: "no_dubbing_evidence" };
    return {
      disposition: "enqueue_extract",
      targets: [
        {
          dubbingLanguage: requestedLanguage,
          sectionIndexes: candidateSectionIndexes,
        },
      ],
    };
  }

  if (evidence.kind === "ambiguous") {
    return {
      disposition: requestedLanguage ? "target_conflict" : "regional_review_required",
      reason: evidence.reasons.join("; ") || "Dubbing evidence could not be assigned to a region.",
    };
  }

  if (requestedLanguage) {
    const requestedRegion = evidence.regions.find(
      (region) => region.language === requestedLanguage,
    );
    if (!requestedRegion) {
      return {
        disposition: "target_conflict",
        reason: `Wikipedia evidence does not include the requested ${requestedLanguage} target.`,
      };
    }
    return {
      disposition: "enqueue_extract",
      targets: [
        {
          dubbingLanguage: requestedRegion.language,
          sectionIndexes: requestedRegion.sectionIndexes,
        },
      ],
    };
  }

  return {
    disposition: "enqueue_extract",
    targets: evidence.regions.map(({ language, sectionIndexes }) => ({
      dubbingLanguage: language,
      sectionIndexes,
    })),
  };
}
