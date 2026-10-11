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

function splitPlainText(text: string, maxChars: number): string[] {
  const fragments: string[] = [];
  let fragment = "";
  for (const line of text.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
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

function splitOversizedTable(lines: string[], maxChars: number): string[] {
  const table = lines.join("");
  if (table.length <= maxChars) return [table];

  let depth = 0;
  let closingIndex = -1;
  const rowStarts: number[] = [];
  for (const [index, line] of lines.entries()) {
    if (/^\s*\{\|/.test(line)) {
      depth += 1;
    } else if (/^\s*\|\}/.test(line)) {
      depth -= 1;
      if (depth === 0) {
        closingIndex = index;
        break;
      }
    } else if (depth === 1 && /^\s*\|-/.test(line)) {
      rowStarts.push(index);
    }
  }

  if (rowStarts.length === 0 || closingIndex < 0) {
    throw new Error(
      "Oversized Wikipedia table has no safe complete-row split; refusing partial extraction",
    );
  }

  const tableHeader = lines.slice(0, rowStarts[0]!).join("");
  const tableFooter = lines.slice(closingIndex).join("");
  const fragments: string[] = [];
  for (const [rowIndex, rowStart] of rowStarts.entries()) {
    const nextRowStart = rowStarts[rowIndex + 1] ?? closingIndex;
    const row = lines.slice(rowStart, nextRowStart).join("");
    const fragment = `${tableHeader}${row}${tableFooter}`;
    if (fragment.length > maxChars) {
      throw new Error(
        "An oversized Wikipedia table row exceeds the safe extraction input limit; refusing to split actor/character cells",
      );
    }
    fragments.push(fragment);
  }
  return fragments;
}

function splitSection(section: WikipediaExtractionSection, maxChars: number): string[] {
  const lines = section.wikitext.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const fragments: string[] = [];
  let plainText = "";
  const flushPlainText = () => {
    if (!plainText) return;
    fragments.push(...splitPlainText(plainText, maxChars));
    plainText = "";
  };

  for (let index = 0; index < lines.length;) {
    if (!/^\s*\{\|/.test(lines[index]!)) {
      plainText += lines[index]!;
      index += 1;
      continue;
    }

    flushPlainText();
    const tableLines: string[] = [];
    let depth = 0;
    do {
      const line = lines[index]!;
      tableLines.push(line);
      if (/^\s*\{\|/.test(line)) depth += 1;
      else if (/^\s*\|\}/.test(line)) depth -= 1;
      index += 1;
    } while (index < lines.length && depth > 0);

    fragments.push(...splitOversizedTable(tableLines, maxChars));
  }

  flushPlainText();
  return fragments.length ? fragments : [""];
}

/**
 * Combine sections in input order. Plain text is split at line boundaries and
 * oversized wikitable content only at complete row boundaries. An individual
 * row that cannot fit is rejected instead of being sent with broken cell links.
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
