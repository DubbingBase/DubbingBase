/** Suggested dubbing regions for UI controls; format validation is independent. */
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

export type DubbingLanguage = string;

export const DEFAULT_DUBBING_LANGUAGE = "fr-FR";
const REGIONAL_DUBBING_LANGUAGE_RE = /^[a-z]{2,3}-[A-Z]{2}$/;

export function isDubbingLanguage(value: unknown): value is DubbingLanguage {
  return typeof value === "string" && REGIONAL_DUBBING_LANGUAGE_RE.test(value);
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
