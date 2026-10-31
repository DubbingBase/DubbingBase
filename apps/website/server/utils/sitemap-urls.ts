export type SitemapDubbingProject = {
  content_id: number;
  content_type: string;
  updated_at: string | null;
};

export type SitemapEntity = {
  id: number;
  updated_at: string | null;
};

export type SitemapToy = {
  content_id: number;
  updated_at: string | null;
};

type SitemapUrl = {
  loc: string;
  lastmod?: string;
  _i18nTransform: true;
};

const MEDIA_ROUTES: Record<string, string> = {
  movie: "movie",
  tv: "show",
  video_game: "game",
  audiobook: "audiobook",
  podcast: "podcast",
  advertisement: "advertisement",
};

function addUrl(urls: Map<string, string | undefined>, path: string, lastmod: string | null) {
  const parsedLastmod = lastmod && Date.parse(lastmod);
  const value = parsedLastmod ? new Date(parsedLastmod).toISOString() : undefined;
  const existing = urls.get(path);

  if (!existing || (value && Date.parse(value) > Date.parse(existing))) {
    urls.set(path, value);
  }
}

export function buildSitemapUrls(
  dubbingProjects: SitemapDubbingProject[],
  actors: SitemapEntity[],
  voiceActors: SitemapEntity[],
  toys: SitemapToy[] = [],
): SitemapUrl[] {
  const urls = new Map<string, string | undefined>();

  for (const project of dubbingProjects) {
    const route = MEDIA_ROUTES[project.content_type];
    const supportsNegativeId = project.content_type === "advertisement";
    if (!route || !Number.isSafeInteger(project.content_id)) continue;
    if (project.content_id === 0 || (!supportsNegativeId && project.content_id < 1)) continue;
    if (project.content_type === "toy") continue;

    addUrl(urls, `/${route}/${project.content_id}`, project.updated_at);
  }

  for (const toy of toys) {
    if (Number.isSafeInteger(toy.content_id) && toy.content_id !== 0) {
      addUrl(urls, `/toy/${toy.content_id}`, toy.updated_at);
    }
  }

  for (const actor of actors) {
    if (Number.isSafeInteger(actor.id) && actor.id > 0) {
      addUrl(urls, `/actor/${actor.id}`, actor.updated_at);
    }
  }

  for (const voiceActor of voiceActors) {
    if (Number.isSafeInteger(voiceActor.id) && voiceActor.id > 0) {
      addUrl(urls, `/voice-actor/${voiceActor.id}`, voiceActor.updated_at);
    }
  }

  return [...urls].map(([loc, lastmod]) => ({
    loc,
    ...(lastmod ? { lastmod } : {}),
    _i18nTransform: true,
  }));
}
