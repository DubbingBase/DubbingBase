const SECTION_LABELS: Record<string, string> = {
  movies: "Movies",
  series: "Series",
  "voice-actors": "Voice Actors",
  studios: "Studios",
  games: "Games",
  movie: "Movies",
  show: "Series",
  game: "Games",
  "voice-actor": "Voice Actors",
  studio: "Studios",
  actor: "Actors",
  leaderboard: "Leaderboard",
  discussions: "Discussions",
  contribute: "Contribute",
  login: "Login",
  register: "Register",
  profile: "Profile",
  settings: "Settings",
  "api-key": "API Key",
  about: "About",
  legal: "Legal",
  privacy: "Privacy",
  terms: "Terms",
  "terms-api": "API Terms",
  guidelines: "Guidelines",
};

const LOCALE_PREFIXES = ["fr"];

function capitalize(value: string): string {
  return value
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function sanitize(json: string): string {
  return json.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

export function useBreadcrumbJsonLd() {
  const route = useRoute();
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
        name: "Home",
        item: locale ? `${SITE}/${locale}` : SITE,
      },
    ];

    let acc = locale ? `/${locale}` : "";
    let position = 2;
    for (const segment of segments) {
      acc += `/${segment}`;
      const name = SECTION_LABELS[segment] ?? capitalize(decodeURIComponent(segment));
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
