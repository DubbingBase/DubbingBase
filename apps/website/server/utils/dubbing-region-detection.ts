import type { DubbingLanguage } from "@app/shared-logic";

export type DubbingEvidence = {
  resolved: Array<{ language: DubbingLanguage; sectionIndexes: number[] }>;
  unresolved: Array<{
    sectionIndexes: number[];
    reason: "ambiguous_region" | "unsupported_region";
    details?: string;
  }>;
};

type DubbingSection = { index: number; heading: string; wikitext: string };
type DubbingDetectionInput = {
  wikipediaLanguage: string;
  sections: DubbingSection[];
};
type RegionMarker = { language: DubbingLanguage; marker: RegExp };

const REGION_MARKERS: RegionMarker[] = [
  {
    language: "fr-FR",
    marker:
      /\bvf\b|version\s+fran[cç]aise|voix\s+fran[cç]aises?|fran[cç]ais\s+de\s+france|french\s*\(france\)/gi,
  },
  {
    language: "fr-CA",
    marker:
      /\bvq\b|version\s+qu[eé]b[eé]coise|voix\s+qu[eé]b[eé]coises?|fran[cç]ais\s+qu[eé]b[eé]cois|french\s+canadian/gi,
  },
  {
    language: "fr-BE",
    marker: /belgian\s+french|fran[cç]ais\s+belge|version\s+belge/gi,
  },
  {
    language: "pt-BR",
    marker:
      /brazilian\s+portuguese|portugu[eê]s\s+brasileiro|dublagem\s+brasileira|vers[aã]o\s+brasileira/gi,
  },
  {
    language: "pt-PT",
    marker:
      /european\s+portuguese|portugu[eê]s\s+europeu|portugu[eê]s\s+de\s+portugal|dobragem\s+portuguesa|vers[aã]o\s+portuguesa/gi,
  },
  {
    language: "es-MX",
    marker:
      /\blatam\b|latin\s+american\s+spanish|espa[nñ]ol\s+latinoamericano|espa[nñ]ol\s+latino|mexican\s+spanish|espa[nñ]ol\s+mexicano|doblaje\s+mexicano|hispanoam[eé]rica/gi,
  },
  {
    language: "es-ES",
    marker:
      /castilian\s+spanish|spanish\s+from\s+spain|espa[nñ]ol\s+de\s+espa[nñ]a|doblaje\s+castellano/gi,
  },
  {
    language: "ca-ES",
    marker: /doblaje\s+catal[aá]n|versi[oó]n\s+en\s+catal[aá]n/gi,
  },
];

const DUBBING_CONTEXT =
  /\b(?:vf|vq)\s*[:：–—-]|\b(?:dub(?:bing|bed|s)?|doublage|com[eé]diens?\s+de\s+doublage|reparto\s+de\s+doblaje|doblaje|dublagem|dobragem|vers[aã]o\s+brasileira|voix\s+(?:fran[cç]aises?|qu[eé]b[eé]coises?)|vozes\s+brasileiras|voces\s+(?:latinas|de\s+doblaje))\b/i;

const EXPLICIT_DUBBING_HEADING =
  /\b(?:dubbing|dubbed|doublage|doblaje|dublagem|dobragem|doppiaggio|synchronsprecher)\b|吹き替え/i;

const UNSUPPORTED_MARKETS: Array<{ marker: RegExp; label: string }> = [
  {
    marker: /\bargentin(?:e|ian|a)\s+(?:spanish\s+)?(?:dub(?:bing|bed|s)?|version)\b/i,
    label: "Argentine Spanish",
  },
  {
    marker: /\bchilean\s+(?:spanish\s+)?(?:dub(?:bing|bed|s)?|version)\b/i,
    label: "Chilean Spanish",
  },
  {
    marker: /\bcolombian\s+(?:spanish\s+)?(?:dub(?:bing|bed|s)?|version)\b/i,
    label: "Colombian Spanish",
  },
  {
    marker: /\bvenezuelan\s+(?:spanish\s+)?(?:dub(?:bing|bed|s)?|version)\b/i,
    label: "Venezuelan Spanish",
  },
  {
    marker: /\bperuvian\s+(?:spanish\s+)?(?:dub(?:bing|bed|s)?|version)\b/i,
    label: "Peruvian Spanish",
  },
  {
    marker: /versi[oó]n\s+en\s+gallego|doblaje\s+gallego/i,
    label: "Galician",
  },
];

function normalizeWikitext(value: string): string {
  let text = value
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<ref\b[^>]*\/>|<ref\b[^>]*>[\s\S]*?<\/ref\s*>/gi, " ")
    .replace(/'{2,5}/g, "")
    .replace(/(?:^|\n)\s*[:*#;]*\s*(?:<small>\s*)?(?:sources?|fuentes?|fontes?)\b[^\n]*/gi, "\n")
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2");

  // Real cast pages keep the dubbed actor names in Doublage/VF/VQ templates.
  // Remove presentation templates only after preserving those named credits.
  while (/\{\{[^{}]*\}\}/.test(text)) {
    text = text.replace(/\{\{([^{}]*)\}\}/g, (_match: string, contents: string) => {
      const [name, ...parameters] = contents.split("|");
      if (/^\s*(?:vf|vq)\s*$/i.test(name ?? "")) return name ?? "";
      if (/^\s*colonnes\s*$/i.test(name ?? "")) {
        return parameters.filter((parameter) => !/^\s*[\w -]+\s*=/.test(parameter)).join("\n");
      }
      if (!/^\s*doublage\s*$/i.test(name ?? "")) return " ";
      return parameters
        .filter((parameter) => /^\s*(?:VF|VQ)\s*=/i.test(parameter))
        .map((parameter) => parameter.replace(/=\s*/, ": "))
        .join("; ");
    });
  }
  return text.replace(/<[^>]*>/g, " ").normalize("NFC");
}

function hasNearbyContext(text: string, marker: RegExp): boolean {
  marker.lastIndex = 0;
  for (const match of text.matchAll(marker)) {
    const start = Math.max(0, (match.index ?? 0) - 100);
    const end = Math.min(text.length, (match.index ?? 0) + match[0].length + 100);
    if (DUBBING_CONTEXT.test(text.slice(start, end))) return true;
  }
  return false;
}

function tableHeadingText(table: string): string {
  const lines: string[] = [];
  let hasHeaders = false;
  for (const line of table.split("\n")) {
    if (hasHeaders && /^\|-/.test(line)) break;
    if (/^!/.test(line)) hasHeaders = true;
    if (/^!|^\|\+/.test(line)) lines.push(line);
  }
  return lines.join("\n");
}

function hasCreditShapedContent(text: string): boolean {
  for (const [table] of text.matchAll(/\{\|[\s\S]*?\|\}/g)) {
    const header = tableHeadingText(table);
    const characterHeader =
      /\b(?:character|role|personnages?|personagem|personagens|personajes?)\b/i.test(header);
    const voiceHeader =
      /\b(?:actor|voice|voix|com[eé]dien|dubber|ator|dublador|doblador|original)\b/i.test(header);
    const voiceColumns =
      /voix\s+originale/i.test(header) && /voix\s+(?:fran[cç]aise|qu[eé]b[eé]coise)/i.test(header);
    const dubbedActorHeader = /\b(?:actor\s+de\s+doblaje|dublador|doblador)\b/i.test(header);
    if (
      ((characterHeader && voiceHeader) || voiceColumns || dubbedActorHeader) &&
      /\n\|-\s*\n[\s\S]*[|!]\s*[^\n|!]{2,}/.test(table)
    )
      return true;
    if (
      /\n\|\s*(?:character|personnage|personagem|personaje)\s*\|\|\s*(?:actor|voice)[^\n]*\n\|\s*[^\n|]{2,}\|\|\s*[^\n|]{2,}/i.test(
        table,
      )
    )
      return true;
  }

  for (const line of text.split("\n")) {
    if (
      /^[*#:;]+\s*(?:version|vers[aã]o|soci[eé]t[eé]|direction|direc[cç][aã]o|direc[cç]tion|tradu[cç][aã]o|traduction|est[uú]dio|studio|adapta[cç][aã]o|adaptation|sonoriza[cç][aã]o)(?=\s|:)/i.test(
        line.trim(),
      )
    )
      continue;
    if (
      /^\s*[*#]+\s*[^\n]{1,160}(?::|[—–-]|\.{3}|\b(?:as|voiced by|voice of|dubbed by|jou[eé] par|doubl[eé] par|interpretado por)\b)\s*[^\n]{2,160}/i.test(
        line,
      )
    )
      return true;
  }

  return (
    /(?:character|role|personnage|personagem|personaje)\s*:\s*[^\n]+\n\s*(?:voice\s+actor|dubber|com[eé]dien)\s*:\s*[^\n]+/i.test(
      text,
    ) ||
    /\b(?:vf|vq)\s*[:：–—-]\s*[^\n|;]{2,120}/i.test(text) ||
    /\b(?:dub(?:bing|bed)?(?:\s+cast)?|doblaje(?:\s+(?:castellano|espa[nñ]ol|mexicano|catal[aá]n))?|dublagem)\s*:\s*[^\n]{2,120}/i.test(
      text,
    ) ||
    /[^\n]{2,120}\b(?:foi\s+dublad[oa]\s+por|dublou|doubl[eé]e?\s+par|voiced\s+by)\s+[^\n]{2,120}/i.test(
      text,
    )
  );
}

function headingLanguages(heading: string): Set<DubbingLanguage> {
  const languages = findLanguages(heading, false);
  if (/doblaje|versi[oó]n\s+de/i.test(heading) && /\bespa[nñ]a\b/i.test(heading))
    languages.add("es-ES");
  return languages;
}

function evidenceBlocks(body: string, heading: string): Array<{ heading: string; text: string }> {
  const blocks: Array<{ heading: string; text: string }> = [];
  const ancestors: Array<{ level: number; heading: string }> = [];
  let start = 0;
  let currentHeading = heading;
  for (const match of body.matchAll(/^(={2,6})\s*(.*?)\s*\1\s*$/gm)) {
    const index = match.index;
    blocks.push({ heading: currentHeading, text: body.slice(start, index) });
    const level = match[1]!.length;
    while (ancestors.length && ancestors.at(-1)!.level >= level) ancestors.pop();
    ancestors.push({ level, heading: match[2]! });
    currentHeading = ancestors.map((ancestor) => ancestor.heading).join(" / ");
    start = index + match[0].length;
  }
  blocks.push({ heading: currentHeading, text: body.slice(start) });
  return blocks.filter((block) => block.text.trim());
}

function tableColumnLanguages(table: string, dubbingContext: boolean): Set<DubbingLanguage> {
  const header = tableHeadingText(table);
  const cells = header
    .split("\n")
    .filter((line) => /^!/.test(line))
    .flatMap((line) => line.replace(/^!+/, "").split("!!"))
    .map((cell) => cell.slice(cell.lastIndexOf("|") + 1).trim());
  const rows = table
    .split(/\n\|-[^\n]*\n/)
    .slice(1)
    .map((row) =>
      row
        .split("\n")
        .filter((line) => /^[|!](?![-+}])/.test(line))
        .flatMap((line) => line.slice(1).split(/\|\||!!/))
        .map((cell) => cell.slice(cell.lastIndexOf("|") + 1).trim()),
    );
  const languages = new Set<DubbingLanguage>();
  const countryColumns =
    dubbingContext &&
    /\boriginal\b/i.test(header) &&
    /\b(?:personagem|personagens)\b/i.test(header);
  for (const [index, cell] of cells.entries()) {
    // A regional header without any named performer beneath it is not credit
    // evidence. Complete rows avoid guessing around rowspan/colspan alignment.
    const namedVoice = rows.some(
      (row) =>
        row.length === cells.length &&
        /\p{L}{2}/u.test(row[index] ?? "") &&
        !/^(?:por anunciar|unknown|uncredited)$/i.test(row[index] ?? ""),
    );
    if (!namedVoice) continue;
    for (const language of findLanguages(cell, false)) languages.add(language);
    if (countryColumns && /^brasil$/i.test(cell)) languages.add("pt-BR");
    if (countryColumns && /^portugal$/i.test(cell)) languages.add("pt-PT");
  }
  return languages;
}

function findLanguages(text: string, requireNearbyContext: boolean): Set<DubbingLanguage> {
  const languages = new Set<DubbingLanguage>();
  for (const { language, marker } of REGION_MARKERS) {
    marker.lastIndex = 0;
    const found = requireNearbyContext ? hasNearbyContext(text, marker) : marker.test(text);
    if (found) languages.add(language);
  }
  return languages;
}

/**
 * Classifies deterministic regional dubbing evidence from Wikipedia sections.
 * Section headings can corroborate credit-shaped content, but cannot establish
 * evidence on their own. The Wikipedia edition never determines a region.
 */
export function detectDubbingRegionFromWikitext({
  wikipediaLanguage: _wikipediaLanguage,
  sections,
}: DubbingDetectionInput): DubbingEvidence {
  const resolved = new Map<DubbingLanguage, Set<number>>();
  const unresolved = new Map<
    string,
    {
      reason: "ambiguous_region" | "unsupported_region";
      details?: string;
      indexes: Set<number>;
    }
  >();

  function addUnresolved(
    index: number,
    reason: "ambiguous_region" | "unsupported_region",
    details?: string,
  ): void {
    const key = `${reason}:${details ?? ""}`;
    const existing = unresolved.get(key);
    if (existing) existing.indexes.add(index);
    else unresolved.set(key, { reason, details, indexes: new Set([index]) });
  }

  for (const section of sections) {
    const body = normalizeWikitext(section.wikitext);
    const heading = normalizeWikitext(section.heading);
    let resolvedSection = false;
    let unresolvedSection = false;
    let unscopedEvidence = false;

    function addLanguages(languages: Set<DubbingLanguage>): void {
      for (const language of languages) {
        resolved.set(language, (resolved.get(language) ?? new Set()).add(section.index));
        resolvedSection = true;
      }
    }

    function classify(text: string, scopeHeading: string, precedingText = "", table = false): void {
      if (!text.trim()) return;
      // Columbo explicitly pairs each named performer with a language version.
      // Keep those associations separate from Spain's surrounding subsection.
      const performerVersions =
        /\b([\p{Lu}][\p{L}'’.-]*(?:\s+[\p{Lu}][\p{L}'’.-]*){1,4})\s+en\s+la\s+versi[oó]n\s+en\s+(catal[aá]n|gallego)\b/gu;
      if (
        (EXPLICIT_DUBBING_HEADING.test(scopeHeading) || DUBBING_CONTEXT.test(text)) &&
        /\blo\s+(?:hicieron|hizo)\b/i.test(text) &&
        /\b(?:prestaron\s+su\s+voz|fueron\s+la\s+voz)\b/i.test(body)
      ) {
        for (const match of text.matchAll(performerVersions)) {
          if (/catal[aá]n/.test(match[2]!)) addLanguages(new Set(["ca-ES"]));
          else {
            addUnresolved(section.index, "unsupported_region", "Galician");
            unresolvedSection = true;
          }
        }
        text = text.replace(performerVersions, " ");
      }
      const creditShaped = hasCreditShapedContent(text);
      const columns = table
        ? tableColumnLanguages(
            text,
            DUBBING_CONTEXT.test(body) || EXPLICIT_DUBBING_HEADING.test(heading),
          )
        : new Set<DubbingLanguage>();
      const tableHeaders = table
        ? tableHeadingText(text)
            .split("\n")
            .filter((line) => /^!/.test(line))
            .join("\n")
        : "";
      const declaredRegionalColumns =
        findLanguages(tableHeaders, false).size > 0 ||
        (/\boriginal\b/i.test(tableHeaders) && /\b(?:brasil|portugal)\b/i.test(tableHeaders));
      if (table && declaredRegionalColumns && columns.size === 0) return;
      const scopedLanguages = headingLanguages(scopeHeading);
      const bodyLanguages = findLanguages(table ? precedingText : text, true);
      const unsupported = UNSUPPORTED_MARKETS.find(({ marker }) =>
        marker.test(`${scopeHeading}\n${text}`),
      );
      const bodyDubbingEvidence = DUBBING_CONTEXT.test(text);
      const headingEvidence =
        EXPLICIT_DUBBING_HEADING.test(scopeHeading) || scopedLanguages.size > 0;
      if (
        !(
          bodyDubbingEvidence ||
          bodyLanguages.size ||
          (creditShaped && (headingEvidence || columns.size || unsupported))
        )
      )
        return;

      // Named VF/VQ credits and separate regional columns can legitimately
      // coexist. A sentence mentioning multiple markets without such credits
      // must still remain unresolved.
      const inlineLanguages = new Set<DubbingLanguage>();
      for (const match of text.matchAll(/\b(vf|vq)\s*[:：–—-]\s*([^\n|;<>]{2,120})/gi)) {
        inlineLanguages.add(match[1]!.toLowerCase() === "vf" ? "fr-FR" : "fr-CA");
      }
      if (inlineLanguages.size > 0) {
        addLanguages(inlineLanguages);
        return;
      }
      if (creditShaped && columns.size > 0) {
        addLanguages(columns);
        return;
      }

      // A table's own caption and a regional subsection identify its credits
      // more precisely than parent headings or notes about reused performances.
      const captionLanguages = table
        ? findLanguages(
            tableHeadingText(text)
              .split("\n")
              .filter((line) => /^\|\+/.test(line))
              .join("\n"),
            false,
          )
        : new Set<DubbingLanguage>();
      const languages = captionLanguages.size
        ? captionLanguages
        : scopedLanguages.size && !unsupported
          ? scopedLanguages
          : bodyLanguages;

      if (languages.size > 1) {
        addUnresolved(section.index, "ambiguous_region", "Conflicting regional markers");
        unresolvedSection = true;
      } else if (!creditShaped) {
        return;
      } else if (unsupported) {
        addUnresolved(
          section.index,
          languages.size ? "ambiguous_region" : "unsupported_region",
          languages.size
            ? "Conflicting supported and unsupported market markers"
            : unsupported.label,
        );
        unresolvedSection = true;
      } else if (creditShaped && languages.size === 1) {
        addLanguages(languages);
      } else if (creditShaped && bodyDubbingEvidence) {
        addUnresolved(section.index, "ambiguous_region");
        unresolvedSection = true;
      } else {
        unscopedEvidence ||= creditShaped && headingEvidence;
      }
    }

    for (const block of evidenceBlocks(body, heading)) {
      let cursor = 0;
      for (const match of block.text.matchAll(/\{\|[\s\S]*?\|\}/g)) {
        const precedingText = block.text.slice(cursor, match.index);
        classify(precedingText, block.heading);
        classify(match[0], block.heading, precedingText, true);
        cursor = match.index + match[0].length;
      }
      classify(block.text.slice(cursor), block.heading);
    }
    if (unscopedEvidence && !resolvedSection && !unresolvedSection)
      addUnresolved(section.index, "ambiguous_region");
  }

  return {
    resolved: [...resolved.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([language, indexes]) => ({
        language,
        sectionIndexes: [...indexes].sort((left, right) => left - right),
      })),
    unresolved: [...unresolved.values()]
      .map(({ reason, details, indexes }) => ({
        sectionIndexes: [...indexes].sort((left, right) => left - right),
        reason,
        ...(details ? { details } : {}),
      }))
      .sort((left, right) => left.sectionIndexes[0]! - right.sectionIndexes[0]!),
  };
}
