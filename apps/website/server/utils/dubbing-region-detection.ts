import type { DubbingLanguage } from "@app/shared-logic";

export type DubbingEvidence =
  | { kind: "none" }
  | {
      kind: "resolved";
      regions: Array<{ language: DubbingLanguage; sectionIndexes: number[] }>;
    }
  | { kind: "ambiguous"; sectionIndexes: number[]; reasons: string[] };

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
  /(?:^|[\n|;])\s*(?:vf|vq)\s*[:：–—-]|\b(?:dub(?:bing|bed|s)?|doublage|com[eé]diens?\s+de\s+doublage|reparto\s+de\s+doblaje|doblaje|dublagem|dublado|vers[aã]o\s+brasileira|voix\s+(?:fran[cç]aises?|qu[eé]b[eé]coises?)|vozes\s+brasileiras|voces\s+(?:latinas|de\s+doblaje))\b/i;

const GENERIC_DUBBING =
  /\b(?:dub(?:bing|bed|s)?|doublage|com[eé]diens?\s+de\s+doublage|reparto\s+de\s+doblaje|doblaje|dublagem|dublado|casting\s+vocal)\b/i;

const UNSUPPORTED_MARKET =
  /\b(?:argentin(?:e|a)|chilean|colombian|venezuelan|peruvian|chilean|mexican|brazilian|portuguese\s+from\s+(?!portugal)|spanish\s+from\s+(?!spain))\b/i;

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

function hasDubbingContext(text: string): boolean {
  return GENERIC_DUBBING.test(text);
}

/**
 * Detects a deliberately narrow set of regional dubbing labels from section
 * text. The Wikipedia edition is accepted as source metadata only and never
 * participates in choosing a dubbing region.
 */
export function detectDubbingRegionFromWikitext({
  wikipediaLanguage: _wikipediaLanguage,
  sections,
}: DubbingDetectionInput): DubbingEvidence {
  const resolved = new Map<DubbingLanguage, Set<number>>();
  const ambiguous = new Map<number, string>();

  for (const section of sections) {
    const text = normalizeWikitext(section.wikitext);
    const matchingLanguages = new Set<DubbingLanguage>();

    for (const { language, marker } of REGION_MARKERS) {
      if (hasNearbyContext(text, marker)) matchingLanguages.add(language);
    }

    if (matchingLanguages.size > 1) {
      ambiguous.set(section.index, "conflicting_markets");
      continue;
    }

    const [language] = matchingLanguages;
    if (language) {
      resolved.set(language, (resolved.get(language) ?? new Set()).add(section.index));
      continue;
    }

    if (!hasDubbingContext(text)) continue;

    if (UNSUPPORTED_MARKET.test(text)) {
      ambiguous.set(section.index, "unsupported_market");
      continue;
    }

    // Evidence for dubbing exists, but the text does not name a supported,
    // unambiguous region. Do not infer one from the language edition.
    ambiguous.set(section.index, "unspecified_market");
  }

  if (ambiguous.size > 0) {
    const entries = [...ambiguous.entries()].sort(([left], [right]) => left - right);
    return {
      kind: "ambiguous",
      sectionIndexes: entries.map(([index]) => index),
      reasons: [...new Set(entries.map(([, reason]) => reason))].sort(),
    };
  }

  if (resolved.size === 0) return { kind: "none" };

  return {
    kind: "resolved",
    regions: [...resolved.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([language, indexes]) => ({
        language,
        sectionIndexes: [...indexes].sort((left, right) => left - right),
      })),
  };
}
