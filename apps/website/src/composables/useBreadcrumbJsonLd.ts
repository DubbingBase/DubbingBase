const SECTION_I18N_KEYS: Record<string, string> = {
  movies: "breadcrumb.sections.movies",
  series: "breadcrumb.sections.series",
  "voice-actors": "breadcrumb.sections.voiceActors",
  studios: "breadcrumb.sections.studios",
  games: "breadcrumb.sections.games",
  movie: "breadcrumb.sections.movies",
  show: "breadcrumb.sections.series",
  game: "breadcrumb.sections.games",
  "voice-actor": "breadcrumb.sections.voiceActors",
  studio: "breadcrumb.sections.studios",
  actor: "breadcrumb.sections.actors",
  leaderboard: "breadcrumb.sections.leaderboard",
  discussions: "breadcrumb.sections.discussions",
  contribute: "breadcrumb.sections.contribute",
  login: "breadcrumb.sections.login",
  register: "breadcrumb.sections.register",
  profile: "breadcrumb.sections.profile",
  settings: "breadcrumb.sections.settings",
  "api-key": "breadcrumb.sections.apiKey",
  about: "breadcrumb.sections.about",
  legal: "breadcrumb.sections.legal",
  privacy: "breadcrumb.sections.privacy",
  terms: "breadcrumb.sections.terms",
  "terms-api": "breadcrumb.sections.termsApi",
  guidelines: "breadcrumb.sections.guidelines",
};

const LOCALE_PREFIXES = ["fr"];

function capitalize(value: string): string {
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitize(json: string): string {
  return json.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export function useBreadcrumbJsonLd() {
  const route = useRoute();
  const { t } = useI18n();
  const SITE = "https://dubbingbase.com";

  const jsonLd = computed(() => {
    const rawSegments = route.path.split("/").filter(Boolean);
    const locale = LOCALE_PREFIXES.includes(rawSegments[0]) ? rawSegments[0] : "";
    const segments = locale ? rawSegments.slice(1) : rawSegments;

    const itemListElement: {
      "@type": "ListItem";
      position: number;
      name: string;
      item: string;
    }[] = [
      {
        "@type": "ListItem",
        position: 1,
        name: t("breadcrumb.home", "Home"),
        item: locale ? `${SITE}/${locale}` : SITE,
      },
    ];

    let acc = locale ? `/${locale}` : "";
    let position = 2;
    for (const segment of segments) {
      acc += `/${segment}`;
      const key = SECTION_I18N_KEYS[segment];
      const name = key ? t(key) : capitalize(safeDecode(segment));
      itemListElement.push({
        "@type": "ListItem",
        position,
        name,
        item: `${SITE}${acc}`,
      });
      position++;
    }

    return sanitize(
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement,
      }),
    );
  });

  return jsonLd;
}
