import type { ExtractedCredit } from "./voice-actor";

export interface WikipediaExtractionSection {
  index: number;
  heading: string;
  wikitext: string;
}

export interface WikipediaExtractionBatch {
  sectionIndexes: number[];
  prompt: string;
}

export const MAX_WIKIPEDIA_EXTRACTION_PROMPT_CHARS = 48_000;

function splitOversizedLine(line: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let chunk = "";
  for (const character of line) {
    if (chunk.length + character.length > maxChars) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk += character;
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

function splitSection(section: WikipediaExtractionSection, maxChars: number): string[] {
  const fragments: string[] = [];
  let fragment = "";
  for (const line of section.wikitext.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    if (line.length > maxChars) {
      if (fragment) fragments.push(fragment);
      fragment = "";
      fragments.push(...splitOversizedLine(line, maxChars));
      continue;
    }
    if (fragment.length + line.length > maxChars) {
      fragments.push(fragment);
      fragment = "";
    }
    fragment += line;
  }
  if (fragment) fragments.push(fragment);
  return fragments.length ? fragments : [""];
}

/**
 * Combine sections in input order. Oversized sections are split by line, then
 * by Unicode code point only for a single overlong line; no source text is dropped.
 */
export function buildWikipediaExtractionBatches(
  sections: WikipediaExtractionSection[],
  maxPromptChars = MAX_WIKIPEDIA_EXTRACTION_PROMPT_CHARS,
): WikipediaExtractionBatch[] {
  if (maxPromptChars <= 0) {
    throw new Error("Wikipedia extraction prompt limit is too small");
  }

  const fragments = sections.flatMap((section) => {
    const boundedSection = {
      ...section,
      heading:
        section.heading.length <= 256 ? section.heading : `${section.heading.slice(0, 255)}…`,
    };
    const largestHeader = `\n\n<<< WIKIPEDIA SECTION #${section.index}: ${boundedSection.heading}, part 999/999 >>>\n`;
    const sectionLimit = maxPromptChars - largestHeader.length;
    if (sectionLimit < 1) throw new Error("Wikipedia section label exceeds the prompt limit");
    return splitSection(boundedSection, sectionLimit).map(
      (wikitext, fragmentIndex, allFragments) => ({
        section: boundedSection,
        wikitext,
        fragmentIndex,
        fragmentCount: allFragments.length,
      }),
    );
  });
  const batches: WikipediaExtractionBatch[] = [];
  let prompt = "";
  let sectionIndexes: number[] = [];

  const flush = () => {
    if (!prompt) return;
    batches.push({ sectionIndexes, prompt });
    prompt = "";
    sectionIndexes = [];
  };

  for (const fragment of fragments) {
    const continuation =
      fragment.fragmentCount > 1
        ? `, part ${fragment.fragmentIndex + 1}/${fragment.fragmentCount}`
        : "";
    const header = `\n\n<<< WIKIPEDIA SECTION #${fragment.section.index}: ${fragment.section.heading}${continuation} >>>\n`;
    const block = `${header}${fragment.wikitext}`;
    if (block.length > maxPromptChars) {
      throw new Error("Wikipedia section prompt exceeded its configured limit");
    }
    if (prompt.length + block.length > maxPromptChars) flush();
    prompt += block;
    if (sectionIndexes.at(-1) !== fragment.section.index) {
      sectionIndexes.push(fragment.section.index);
    }
  }
  flush();
  return batches;
}

/** Drop repeated model rows while retaining distinct actors, people, or roles. */
export function deduplicateExtractedCredits(credits: ExtractedCredit[]): ExtractedCredit[] {
  const seen = new Set<string>();
  return credits.filter((credit) => {
    const key = [
      credit.actorId,
      credit.firstname.trim().toLowerCase(),
      credit.lastname.trim().toLowerCase(),
      (credit.performance ?? "").trim().toLowerCase(),
      credit.characterId ?? "",
      (credit.characterName ?? "").trim().toLowerCase(),
    ].join("\u001f");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
