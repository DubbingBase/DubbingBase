/** Explicit dubbing markets. UI locales and Wikipedia editions are separate. */
export enum DubbingLanguage {
  FrenchFrance = "fr-FR",
  FrenchCanada = "fr-CA",
  FrenchBelgium = "fr-BE",
  EnglishUS = "en-US",
  EnglishUK = "en-GB",
  JapaneseJapan = "ja-JP",
  SpanishSpain = "es-ES",
  SpanishMexico = "es-MX",
  GermanGermany = "de-DE",
  ItalianItaly = "it-IT",
  PortugueseBrazil = "pt-BR",
  PortuguesePortugal = "pt-PT",
  ArabicEgypt = "ar-EG",
  CatalanSpain = "ca-ES",
  CebuanoPhilippines = "ceb-PH",
  CroatianCroatia = "hr-HR",
  CzechCzechia = "cs-CZ",
  DanishDenmark = "da-DK",
  DutchNetherlands = "nl-NL",
  GreekGreece = "el-GR",
  HausaNigeria = "ha-NG",
  HebrewIsrael = "he-IL",
  HungarianHungary = "hu-HU",
  IndonesianIndonesia = "id-ID",
  LatinVaticanCity = "la-VA",
  MalayMalaysia = "ms-MY",
  NorwegianNorway = "no-NO",
  PolishPoland = "pl-PL",
  RomanianRomania = "ro-RO",
  RussianRussia = "ru-RU",
  ScotsUnitedKingdom = "sco-GB",
  SerboCroatianSerbia = "sh-RS",
  SlovakSlovakia = "sk-SK",
  ShonaZimbabwe = "sn-ZW",
  AragoneseSpain = "an-ES",
  SwedishSweden = "sv-SE",
  SwissGermanSwitzerland = "gsw-CH",
  TagalogPhilippines = "tl-PH",
  TurkishTurkiye = "tr-TR",
  UkrainianUkraine = "uk-UA",
  VietnameseVietnam = "vi-VN",
  WelshUnitedKingdom = "cy-GB",
  WesternFrisianNetherlands = "fy-NL",
  ChineseChina = "zh-CN",
}

export const DUBBING_LANGUAGES: readonly DubbingLanguage[] =
  Object.values(DubbingLanguage);
export const DEFAULT_DUBBING_LANGUAGE: DubbingLanguage =
  DubbingLanguage.FrenchFrance;

export function isDubbingLanguage(value: unknown): value is DubbingLanguage {
  return (
    typeof value === "string" &&
    DUBBING_LANGUAGES.some((code) => code === value)
  );
}

export function validateDubbingLanguage(value: unknown): DubbingLanguage {
  if (!isDubbingLanguage(value)) {
    throw new Error(
      "An approved regional dubbing language is required (for example fr-FR or de-DE)",
    );
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
