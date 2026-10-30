const dataset = process.env.ROUTE_CPU_DATASET;
if (dataset !== "representative" && dataset !== "large") {
  throw new Error(`Unsupported route CPU fixture dataset: ${dataset}`);
}

const sizes =
  dataset === "representative"
    ? {
        mediaCredits: 180,
        dubbingProjects: 40,
        actorCredits: 640,
        actorRoles: 24,
        voiceActorWorks: 24,
        uniqueMedia: 12,
      }
    : {
        mediaCredits: 1200,
        dubbingProjects: 500,
        actorCredits: 1200,
        actorRoles: 500,
        voiceActorWorks: 500,
        uniqueMedia: 100,
      };
const searchResultsPerSource = dataset === "large" ? 20 : 10;

function makeCast(count, mediaType = "movie") {
  return Array.from({ length: count }, (_, index) => ({
    id: 200_000 + index,
    name: `CI fixture ${mediaType} cast ${index}`,
    title: `CI fixture movie ${index}`,
    character: `CI fixture character ${index}`,
    poster_path: `/cast-${index}.jpg`,
    profile_path: `/person-${index}.jpg`,
    backdrop_path: `/backdrop-${index}.jpg`,
    release_date: "2020-01-01",
    first_air_date: "2021-01-01",
    popularity: index,
    roles: [{ character: `CI fixture character ${index}`, episode_count: 3 }],
  }));
}

function makeMedia(id, mediaType, credits = 0) {
  const data = {
    id,
    title: mediaType === "movie" ? `CI fixture movie ${id}` : undefined,
    name: mediaType === "tv" ? `CI fixture show ${id}` : undefined,
    original_title: `CI original ${id}`,
    original_name: `CI original ${id}`,
    overview: "Deterministic local route CPU fixture. ".repeat(20),
    poster_path: `/media-${id}.jpg`,
    backdrop_path: `/backdrop-${id}.jpg`,
    release_date: mediaType === "movie" ? "2020-01-01" : undefined,
    first_air_date: mediaType === "tv" ? "2021-01-01" : undefined,
    vote_average: 7.5,
    popularity: 100,
    adult: false,
    external_ids: { tvdb_id: 9_000 + id },
  };
  if (credits > 0) data.credits = { cast: makeCast(credits, mediaType) };
  return data;
}

const actorMovieCount = Math.floor(sizes.actorCredits * 0.6);
const actor = {
  id: 6384,
  name: "CI fixture actor",
  biography: "Deterministic local route CPU fixture. ".repeat(20),
  birthday: "1980-01-01",
  deathday: null,
  place_of_birth: "Local fixture",
  known_for_department: "Acting",
  profile_path: "/actor.jpg",
  movie_credits: { cast: makeCast(actorMovieCount, "movie") },
  tv_credits: { cast: makeCast(sizes.actorCredits - actorMovieCount, "tv") },
};

const actorRoles = Array.from({ length: sizes.actorRoles }, (_, index) => {
  const voiceActorId = 50_000 + (index % 100);
  return {
    id: index + 1,
    performance: `CI fixture performance ${index}`,
    voice_actors: {
      id: voiceActorId,
      firstname: `CI Voice ${voiceActorId}`,
      lastname: "Actor",
      profile_picture: `voice-actor-${voiceActorId}.jpg`,
    },
    dubbing_projects: {
      language: index % 2 === 0 ? "fr-FR" : "en-US",
      content_id: 100_000 + index,
    },
  };
});

const dubbingProjects = Array.from({ length: sizes.dubbingProjects }, (_, index) => ({
  id: index + 1,
  language: index % 2 === 0 ? "fr-FR" : "en-US",
  studio_data: { id: 10_000 + index, name: `CI studio ${index}`, logo_url: null },
  works: [
    {
      id: index + 1,
      actor_id: 200_000 + index,
      character_name: `CI character ${index}`,
      performance: `CI performance ${index}`,
      note: null,
      voice_actor: {
        id: 50_000 + (index % 100),
        firstname: `CI Voice ${index % 100}`,
        lastname: "Actor",
        profile_picture: `voice-actor-${index % 100}.jpg`,
        voice_actor_name: `CI Voice ${index % 100} Actor`,
      },
    },
  ],
}));

const voiceActor = {
  id: 1,
  firstname: "CI fixture voice actor",
  lastname: "Actor",
  voice_actor_name: "CI fixture voice actor Actor",
  bio: "Deterministic local route CPU fixture. ".repeat(20),
  profile_picture: "voice-actor.jpg",
  tmdb_id: 12_001,
  work: Array.from({ length: sizes.voiceActorWorks }, (_, index) => ({
    id: index + 1,
    actor_id: 200_000 + index,
    performance: `CI performance ${index}`,
    note: null,
    character_name: `CI character ${index}`,
    dubbing_projects: {
      content_id: 300_000 + (index % sizes.uniqueMedia),
      content_type: index % 2 === 0 ? "movie" : "tv",
      studios: { id: 10, name: "CI studio", logo_url: null },
    },
  })),
};

const searchTmdbResults = Array.from(
  { length: searchResultsPerSource * 2 },
  (_, index) => ({
    id: 700_000 + index,
    title: `CI fixture search movie ${index}`,
    media_type: "movie",
    popularity: index + 1,
    vote_average: 7.5,
    vote_count: index + 10,
  }),
);
const searchVoiceActors = Array.from({ length: searchResultsPerSource }, (_, index) => ({
  id: 800_000 + index,
  firstname: `CI fixture search voice ${index}`,
  lastname: "Actor",
  voice_actor_name: `CI fixture search voice ${index} Actor`,
  profile_picture: null,
  popularity: index + 1,
  vote_average: 0,
  vote_count: index + 1,
}));
const searchGames = Array.from({ length: Math.min(searchResultsPerSource, 10) }, (_, index) => ({
  id: 810_000 + index,
  name: `CI fixture search game ${index}`,
  rating: 75,
  rating_count: index + 1,
}));
const searchBooks = Array.from({ length: searchResultsPerSource }, (_, index) => ({
  key: `/works/OL${820_000 + index}W`,
  title: `CI fixture search book ${index}`,
  author_name: [`CI fixture author ${index}`],
}));
const searchPodcasts = Array.from({ length: searchResultsPerSource }, (_, index) => ({
  collectionId: 830_000 + index,
  collectionName: `CI fixture search podcast ${index}`,
}));
const searchAdvertisements = Array.from({ length: searchResultsPerSource }, (_, index) => ({
  content_id: 840_000 + index,
  studios: { name: `CI fixture studio ${index}` },
}));
const searchToys = Array.from({ length: searchResultsPerSource }, (_, index) => ({
  content_id: 850_000 + index,
  name: `CI fixture search toy ${index}`,
  manufacturer: "CI fixture manufacturer",
  product_line: null,
  release_year: null,
  cover_url: null,
  description: null,
  updated_at: null,
}));

const encodedResponses = new Map();
function addJsonResponse(key, value) {
  encodedResponses.set(key, JSON.stringify(value));
}

addJsonResponse("tmdb:/3/movie/85", makeMedia(85, "movie", sizes.mediaCredits));
addJsonResponse("tmdb:/3/tv/1396", makeMedia(1396, "tv"));
addJsonResponse("tmdb:/3/tv/1396/aggregate_credits", {
  cast: makeCast(sizes.mediaCredits, "tv"),
});
addJsonResponse("tmdb:/3/person/6384", actor);
addJsonResponse("tmdb:/3/person/12001", {
  id: 12_001,
  movie_credits: { cast: makeCast(20, "movie") },
  tv_credits: { cast: makeCast(20, "tv") },
});

for (let index = 0; index < sizes.uniqueMedia; index += 1) {
  const mediaType = index % 2 === 0 ? "movie" : "tv";
  const mediaId = 300_000 + index;
  addJsonResponse(`tmdb:/3/${mediaType}/${mediaId}`, makeMedia(mediaId, mediaType));
}

const supabaseResponse = (path) => {
  const table = path.replace(/^\/rest\/v1\//, "").split("?")[0];
  if (table === "voice_actors") {
    const query = new URLSearchParams(path.split("?")[1] ?? "");
    if (query.has("voice_actor_name")) return { value: searchVoiceActors, single: false };
    if (query.has("or")) return { value: searchVoiceActors, single: false };
    return { value: voiceActor, single: true };
  }
  if (table === "work") return { value: actorRoles, single: false };
  if (table === "toy_metadata") return { value: searchToys, single: false };
  if (table === "dubbing_projects") {
    const query = new URLSearchParams(path.split("?")[1] ?? "");
    return query.get("content_type") === "eq.advertisement"
      ? { value: searchAdvertisements, single: false }
      : { value: dubbingProjects, single: false };
  }
  throw new Error(`Unexpected mocked Supabase table: ${table}`);
};

const requestCounts = new Map();
globalThis.__routeCpuUpstreamRequests = requestCounts;

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  let key;
  let body;

  if (url.hostname === "api.themoviedb.org") {
    key = url.pathname === "/3/search/multi"
      ? `tmdb:${url.pathname}?page=${url.searchParams.get("page")}`
      : `tmdb:${url.pathname}`;
    body = url.pathname === "/3/search/multi"
      ? JSON.stringify({ results: searchTmdbResults.slice(
          Number(url.searchParams.get("page") ?? "1") === 1 ? 0 : searchResultsPerSource,
          Number(url.searchParams.get("page") ?? "1") === 1
            ? searchResultsPerSource
            : searchResultsPerSource * 2,
        ) })
      : encodedResponses.get(key);
    if (body === undefined) throw new Error(`Unexpected mocked TMDB request: ${url.pathname}`);
  } else if (url.hostname === "mock.supabase.co") {
    const response = supabaseResponse(`${url.pathname}${url.search}`);
    const table = url.pathname.split("/").at(-1);
    key = table === "voice_actors"
      ? `supabase:voice_actors_${url.searchParams.has("voice_actor_name") ? "fts" : "ilike"}`
      : `supabase:${table}`;
    const inputHeaders = input instanceof Request ? input.headers : undefined;
    const acceptsSingle = new Headers(init.headers ?? inputHeaders)
      .get("accept")
      ?.includes("vnd.pgrst.object");
    body = JSON.stringify(response.single && !acceptsSingle ? [response.value] : response.value);
  } else if (url.hostname === "id.twitch.tv" && url.pathname === "/oauth2/token") {
    key = "igdb:token";
    body = JSON.stringify({ access_token: "local-route-cpu-fixture", expires_in: 7_200 });
  } else if (url.hostname === "api.igdb.com" && url.pathname === "/v4/games") {
    key = "igdb:games";
    body = JSON.stringify(searchGames);
  } else if (url.hostname === "openlibrary.org" && url.pathname === "/search.json") {
    key = "openlibrary:search";
    body = JSON.stringify({ docs: searchBooks });
  } else if (url.hostname === "itunes.apple.com" && url.pathname === "/search") {
    key = "itunes:search";
    body = JSON.stringify({ resultCount: searchPodcasts.length, results: searchPodcasts });
  } else if (url.hostname === "api4.thetvdb.com") {
    key = `tvdb:${url.pathname}`;
    body =
      url.pathname === "/v4/login"
        ? JSON.stringify({ data: { token: "local-route-cpu-fixture" } })
        : url.pathname === "/v4/search"
          ? JSON.stringify({ data: [] })
          : JSON.stringify({ data: { characters: [] } });
  } else {
    throw new Error(`Blocked unexpected outbound request: ${url.origin}${url.pathname}`);
  }

  requestCounts.set(key, (requestCounts.get(key) ?? 0) + 1);
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
