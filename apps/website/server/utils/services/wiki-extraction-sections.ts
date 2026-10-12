import type { WikipediaCache } from "../cache/wikipedia";
import { filterValidSectionIndexes } from "../cache/wikipedia";
import type { WikipediaExtractionSection } from "./wiki-extraction-batching";

type SectionList = Awaited<ReturnType<WikipediaCache["getPageSections"]>>;

export interface ScanSectionMetadata {
  revisionId?: number;
  sectionHeadings?: string[];
}

export type ValidatedExtractionSections =
  | { ok: true; revisionId: number; sections: WikipediaExtractionSection[] }
  | { ok: false; error: string };

function sectionList(response: SectionList) {
  return response.parse?.tocdata?.sections || response.parse?.sections || [];
}

function retryableRevisionError(message: string): Error {
  const error = new Error(message);
  error.name = "RetryableQueueItemError";
  return error;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  map: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(items.length, concurrency) }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await map(items[index]!);
      }
    }),
  );
  return results;
}

async function fetchAtRevision(
  wikipedia: WikipediaCache,
  pageId: number,
  language: string,
  revisionId: number,
  sectionIndexes: number[],
  headings: string[],
): Promise<WikipediaExtractionSection[] | null> {
  const responses = await mapWithConcurrency(sectionIndexes, 4, (index) =>
    wikipedia.getPageSectionAsWikitext(pageId, String(index), language, revisionId),
  );
  if (
    responses.some(
      (response) =>
        response.parse?.revid !== revisionId || typeof response.parse?.wikitext !== "string",
    )
  ) {
    return null;
  }
  return responses.map((response, index) => ({
    index: sectionIndexes[index]!,
    heading: headings[index] || `Section ${sectionIndexes[index]}`,
    wikitext: response.parse!.wikitext!,
  }));
}

/**
 * Read scan-validated sections at their pinned revision without fetching a TOC.
 * A current TOC is read only when the pinned revision cannot be used, and then
 * only sections whose original headings still match are allowed through.
 */
export async function getValidatedExtractionSections(options: {
  wikipedia: WikipediaCache;
  pageId: number;
  language: string;
  sectionIndexes: number[];
  scanMetadata?: ScanSectionMetadata;
}): Promise<ValidatedExtractionSections> {
  const { wikipedia, pageId, language, sectionIndexes, scanMetadata } = options;
  const expectedHeadings = scanMetadata?.sectionHeadings;
  const hasPinnedMetadata =
    typeof scanMetadata?.revisionId === "number" &&
    scanMetadata.revisionId > 0 &&
    Array.isArray(expectedHeadings) &&
    expectedHeadings.length === sectionIndexes.length;

  if (hasPinnedMetadata) {
    const pinnedSections = await fetchAtRevision(
      wikipedia,
      pageId,
      language,
      scanMetadata.revisionId!,
      sectionIndexes,
      expectedHeadings,
    );
    if (pinnedSections) {
      return {
        ok: true,
        revisionId: scanMetadata.revisionId!,
        sections: pinnedSections,
      };
    }
  }

  const current = await wikipedia.getPageSections(pageId, language);
  const currentRevisionId = current.parse?.revid;
  if (!currentRevisionId) {
    throw retryableRevisionError("Wikipedia did not return a revision ID for extraction sections");
  }
  const currentSections = sectionList(current);
  const validIndexes = await filterValidSectionIndexes(currentSections, sectionIndexes);
  if (validIndexes.length !== sectionIndexes.length) {
    return {
      ok: false,
      error: `Stale queue element: section(s) [${sectionIndexes.join(", ")}] no longer exist on the "${language}" Wikipedia page.`,
    };
  }

  if (
    hasPinnedMetadata &&
    expectedHeadings.some((heading, index) => {
      const section = currentSections.find(
        (candidate) => candidate.index === sectionIndexes[index],
      );
      return Boolean(heading && (!section || section.line !== heading));
    })
  ) {
    return {
      ok: false,
      error: `Stale queue element: Wikipedia headings changed since revision ${scanMetadata.revisionId}.`,
    };
  }

  const currentHeadings = sectionIndexes.map(
    (index) =>
      currentSections.find((section) => section.index === index)?.line ?? `Section ${index}`,
  );
  const sections = await fetchAtRevision(
    wikipedia,
    pageId,
    language,
    currentRevisionId,
    sectionIndexes,
    currentHeadings,
  );
  if (!sections) {
    throw retryableRevisionError("Wikipedia section content did not match the validated revision");
  }
  return { ok: true, revisionId: currentRevisionId, sections };
}
