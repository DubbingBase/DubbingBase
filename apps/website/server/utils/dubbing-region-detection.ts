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
    marker: /\bvf\b|version\s+fran[cç]aise|fran[cç]ais\s+de\s+france|french\s*\(france\)/gi,
  },
  {
    language: "fr-CA",
    marker: /\bvq\b|version\s+qu[eé]b[eé]coise|fran[cç]ais\s+qu[eé]b[eé]cois|french\s+canadian/gi,
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
      /european\s+portuguese|portugu[eê]s\s+europeu|portugu[eê]s\s+de\s+portugal|dublagem\s+portuguesa/gi,
  },
  {
    language: "es-MX",
    marker:
      /\blatam\b|latin\s+american\s+spanish|espa[nñ]ol\s+latinoamericano|espa[nñ]ol\s+latino|mexican\s+spanish|espa[nñ]ol\s+mexicano|doblaje\s+mexicano/gi,
  },
  {
    language: "es-ES",
    marker:
      /castilian\s+spanish|spanish\s+from\s+spain|espa[nñ]ol\s+de\s+espa[nñ]a|doblaje\s+espa[nñ]ol/gi,
  },
];

const DUBBING_CONTEXT =
  /\b(?:vf|vq)\s*[:：–—-]|\b(?:dub(?:bing|bed|s)?|doublage|com[eé]diens?\s+de\s+doublage|reparto\s+de\s+doblaje|doblaje|dublagem|dublado|vers[aã]o\s+brasileira|voix\s+(?:fran[cç]aises?|qu[eé]b[eé]coises?)|vozes\s+brasileiras|voces\s+(?:latinas|de\s+doblaje))\b/i;

const EXPLICIT_DUBBING_HEADING =
  /\b(?:dubbing|dubbed|doublage|doblaje|dublagem|doppiaggio|synchronsprecher)\b|吹き替え/i;

const UNSUPPORTED_MARKETS: Array<{ marker: RegExp; label: string }> = [
  { marker: /\bargentin(?:e|a)\b/i, label: "Argentine Spanish" },
  { marker: /\bchilean\b/i, label: "Chilean Spanish" },
  { marker: /\bcolombian\b/i, label: "Colombian Spanish" },
  { marker: /\bvenezuelan\b/i, label: "Venezuelan Spanish" },
  { marker: /\bperuvian\b/i, label: "Peruvian Spanish" },
];

function normalizeWikitext(value: string): string {
  return value
    .replace(/\{\{[^{}]*\}\}/g, " ")
    .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, "$2")
    .replace(/'{2,5}/g, "")
    .normalize("NFC");
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

function hasCreditShapedContent(text: string): boolean {
  const table = /\{\|[\s\S]*?\|\}/.exec(text)?.[0];
  if (
    table &&
    /(?:character|role|personnage|personagem|personaje)\b[\s\S]{0,180}\b(?:actor|voice|com[eé]dien|dubber)\b|(?:actor|voice|com[eé]dien|dubber)\b[\s\S]{0,180}(?:character|role|personnage|personagem|personaje)\b/i.test(
      table,
    )
  ) {
    return true;
  }

  if (
    /(?:^|\n)\s*[|!*#]\s*[^\n]{1,120}(?:\|\||\b(?:as|voiced by|voice of|dubbed by|jou[eé] par|doubl[eé] par|interpretado por)\b|[—–])\s*[^\n]{2,120}/i.test(
      text,
    )
  ) {
    return true;
  }

  return /(?:^|[\n|;])\s*(?:vf|vq)\s*[:：–—-]\s*[^\n|;]{2,120}/i.test(text);
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
    const creditShaped = hasCreditShapedContent(body);
    const bodyLanguages = findLanguages(body, true);
    const headingLanguages = creditShaped
      ? findLanguages(heading, false)
      : new Set<DubbingLanguage>();
    const languages = new Set([...bodyLanguages, ...headingLanguages]);
    const unsupported = UNSUPPORTED_MARKETS.find(({ marker }) =>
      marker.test(`${heading}\n${body}`),
    );
    const bodyDubbingEvidence = DUBBING_CONTEXT.test(body);
    const headingDubbingEvidence = creditShaped && EXPLICIT_DUBBING_HEADING.test(heading);
    const headingRegionEvidence = creditShaped && headingLanguages.size > 0;
    const evidenceExists =
      bodyLanguages.size > 0 ||
      bodyDubbingEvidence ||
      headingDubbingEvidence ||
      headingRegionEvidence ||
      (creditShaped && unsupported !== undefined);

    if (!evidenceExists) continue;

    if (languages.size > 1) {
      addUnresolved(section.index, "ambiguous_region", "Conflicting regional markers");
      continue;
    }

    if (unsupported) {
      if (languages.size === 1) {
        addUnresolved(
          section.index,
          "ambiguous_region",
          "Conflicting supported and unsupported market markers",
        );
      } else {
        addUnresolved(section.index, "unsupported_region", unsupported.label);
      }
      continue;
    }

    const [language] = languages;
    if (language) {
      resolved.set(language, (resolved.get(language) ?? new Set()).add(section.index));
      continue;
    }

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
