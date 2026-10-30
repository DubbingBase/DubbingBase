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

const duplicateVoiceActorGroups = Array.from(
  { length: dataset === "large" ? 1200 : 50 },
  (_, groupIndex) => ({
    actors: Array.from({ length: 3 }, (_, actorIndex) => {
      const id = groupIndex * 3 + actorIndex + 1;
      return {
        id,
        firstname: `CI fixture duplicate actor ${id}`,
        lastname: "Actor",
        bio: "x".repeat(792),
        nationality: "Fixture",
        date_of_birth: "1980-01-01",
        tmdb_id: id,
        wikidata_id: `Q${id}`,
        profile_picture: `duplicate-actor-${id}.jpg`,
      };
    }),
  }),
);
const encodedDuplicateVoiceActorGroups = JSON.stringify(duplicateVoiceActorGroups);

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
    return { value: voiceActor, single: true };
  }
  if (table === "work") return { value: actorRoles, single: false };
  if (table === "dubbing_projects") return { value: dubbingProjects, single: false };
  throw new Error(`Unexpected mocked Supabase table: ${table}`);
};

const requestCounts = new Map();
globalThis.__routeCpuUpstreamRequests = requestCounts;

globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  let key;
  let body;

  if (url.hostname === "api.themoviedb.org") {
    key = `tmdb:${url.pathname}`;
    body = encodedResponses.get(key);
    if (body === undefined) throw new Error(`Unexpected mocked TMDB request: ${url.pathname}`);
  } else if (url.hostname === "mock.supabase.co") {
    if (url.pathname === "/auth/v1/user") {
      key = "supabase:auth_user";
      body = JSON.stringify({
        id: "00000000-0000-4000-8000-000000000999",
        email: "admin@example.test",
        role: "authenticated",
        aud: "authenticated",
        app_metadata: { role: "admin" },
        user_metadata: {},
        created_at: "2020-01-01T00:00:00Z",
      });
    } else if (url.pathname === "/rest/v1/rpc/find_duplicate_voice_actors_rpc") {
      key = "supabase:rpc:find_duplicate_voice_actors_rpc";
      body = encodedDuplicateVoiceActorGroups;
    } else {
      const response = supabaseResponse(url.pathname);
      key = `supabase:${url.pathname.split("/").at(-1)}`;
      const inputHeaders = input instanceof Request ? input.headers : undefined;
      const acceptsSingle = new Headers(init.headers ?? inputHeaders)
        .get("accept")
        ?.includes("vnd.pgrst.object");
      body = JSON.stringify(response.single && !acceptsSingle ? [response.value] : response.value);
    }
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
