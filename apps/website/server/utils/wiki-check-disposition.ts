import type { DubbingLanguage } from "@app/shared-logic";
import type { DubbingEvidence } from "./dubbing-region-detection";

export type WikiCheckArchiveReason =
  | "no_candidate_sections"
  | "no_dubbing_evidence"
  | "ambiguous_region"
  | "unsupported_region"
  | "target_conflict"
  | "adult_content_excluded";

export type WikiCheckSkippedResult = {
  sectionIndexes: number[];
  reason: "ambiguous_region" | "unsupported_region";
  details?: string;
};

export type WikiCheckDisposition =
  | {
      disposition: "archive";
      reason: WikiCheckArchiveReason;
      details?: string;
      skipped: WikiCheckSkippedResult[];
    }
  | {
      disposition: "enqueue_extract";
      targets: Array<{
        dubbingLanguage: DubbingLanguage;
        sectionIndexes: number[];
      }>;
      skipped: WikiCheckSkippedResult[];
    };

function archive(
  reason: WikiCheckArchiveReason,
  details: string | undefined,
  skipped: WikiCheckSkippedResult[],
): WikiCheckDisposition {
  return {
    disposition: "archive",
    reason,
    ...(details ? { details } : {}),
    skipped,
  };
}

export function wikiCheckDisposition(
  evidence: DubbingEvidence,
  candidateSectionIndexes: number[],
  requestedLanguage?: DubbingLanguage,
): WikiCheckDisposition {
  if (candidateSectionIndexes.length === 0) {
    return archive("no_candidate_sections", undefined, []);
  }

  if (evidence.resolved.length === 0 && evidence.unresolved.length === 0) {
    return archive("no_dubbing_evidence", undefined, []);
  }

  const skipped: WikiCheckSkippedResult[] = evidence.unresolved.map((item) => ({
    sectionIndexes: item.sectionIndexes,
    reason: item.reason,
    ...(item.details ? { details: item.details } : {}),
  }));

  if (requestedLanguage) {
    const requestedTarget = evidence.resolved.find(
      (region) => region.language === requestedLanguage,
    );
    if (requestedTarget) {
      return {
        disposition: "enqueue_extract",
        targets: [
          {
            dubbingLanguage: requestedTarget.language,
            sectionIndexes: requestedTarget.sectionIndexes,
          },
        ],
        skipped,
      };
    }

    if (evidence.resolved.length > 0) {
      const detected = evidence.resolved.map((region) => region.language).join(", ");
      return archive(
        "target_conflict",
        `Requested ${requestedLanguage}; detected ${detected}.`,
        skipped,
      );
    }

    return archive(
      skipped.some((item) => item.reason === "unsupported_region")
        ? "unsupported_region"
        : "ambiguous_region",
      `Requested ${requestedLanguage}, but the dubbing region could not be resolved safely.`,
      skipped,
    );
  }

  if (evidence.resolved.length === 0) {
    return archive(
      skipped.some((item) => item.reason === "unsupported_region")
        ? "unsupported_region"
        : "ambiguous_region",
      undefined,
      skipped,
    );
  }

  return {
    disposition: "enqueue_extract",
    targets: evidence.resolved.map(({ language, sectionIndexes }) => ({
      dubbingLanguage: language,
      sectionIndexes,
    })),
    skipped,
  };
}
