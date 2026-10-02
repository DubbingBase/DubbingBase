/** Supported dubbing regions for UI controls and request validation. */
export const DUBBING_LANGUAGE_OPTIONS = [
  "fr-FR",
  "fr-CA",
  "fr-BE",
  "en-US",
  "en-GB",
  "ja-JP",
  "ko-KR",
  "es-ES",
  "es-MX",
  "de-DE",
  "it-IT",
  "pt-BR",
  "pt-PT",
  "sq-AL",
  "ar-EG",
  "ca-ES",
  "ceb-PH",
  "hr-HR",
  "cs-CZ",
  "da-DK",
  "nl-NL",
  "el-GR",
  "ha-NG",
  "he-IL",
  "hu-HU",
  "id-ID",
  "la-VA",
  "ms-MY",
  "no-NO",
  "pl-PL",
  "ro-RO",
  "ru-RU",
  "sco-GB",
  "sh-RS",
  "sk-SK",
  "sn-ZW",
  "an-ES",
  "sv-SE",
  "gsw-CH",
  "tl-PH",
  "tr-TR",
  "uk-UA",
  "vi-VN",
  "cy-GB",
  "fy-NL",
  "zh-CN",
  "yue-HK",
] as const;

export type DubbingLanguage = (typeof DUBBING_LANGUAGE_OPTIONS)[number];

export const DEFAULT_DUBBING_LANGUAGE: DubbingLanguage = "fr-FR";
const DUBBING_LANGUAGE_SET: ReadonlySet<string> = new Set(DUBBING_LANGUAGE_OPTIONS);

export function isDubbingLanguage(value: unknown): value is DubbingLanguage {
  return typeof value === "string" && DUBBING_LANGUAGE_SET.has(value);
}

export function validateDubbingLanguage(value: unknown): DubbingLanguage {
  if (!isDubbingLanguage(value)) {
    throw new Error("A regional dubbing language is required (for example fr-FR)");
  }
  return value;
}

export function displayDubbingLanguage(code: string, locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: "language" }).of(code);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : code;
  } catch {
    return code;
  }
}
