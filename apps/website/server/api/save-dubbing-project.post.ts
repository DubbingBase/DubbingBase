import { requireAdmin } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";
import {
  useIgdbClient,
  useOpenLibraryClient,
  usePodcastClient,
  useTmdbClient,
} from "../utils";
import { requireDubbingLanguage } from "../utils/dubbing-language";

type MediaType =
  | "movie"
  | "tv"
  | "video_game"
  | "audiobook"
  | "podcast"
  | "advertisement"
  | "toy";
const MEDIA_TYPES: readonly MediaType[] = [
  "movie",
  "tv",
  "video_game",
  "audiobook",
  "podcast",
  "advertisement",
  "toy",
];

function projectSaveError(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: message, message });
}

interface WorkExpectedValues {
  actor_id: number | null;
  character_id: number | null;
  character_name: string | null;
  voice_actor_id: number | null;
  performance: string | null;
  note: string | null;
  highlight: boolean | null;
  status: string | null;
}

interface CastSaveRow {
  id?: number;
  expected_updated_at?: string | null;
  expected?: WorkExpectedValues;
  actor_id?: number | null;
  character_id?: number | null;
  character_name?: string | null;
  voice_actor_id?: number | null;
  performance?: string | null;
  note?: string | null;
  highlight?: boolean | null;
}

interface CrewSaveRow {
  job_id: number;
  person_id: number;
}

interface ProjectSaveBody {
  request_id: string;
  project_id: number | null;
  expected_updated_at: string | null;
  project: {
    content_id: number;
    content_type: MediaType;
    language: string;
    studio_id: number | null;
    status: "validated" | "pending" | "draft";
  };
  crew: CrewSaveRow[];
  cast: CastSaveRow[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
) {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isMediaType(value: unknown): value is MediaType {
  return MEDIA_TYPES.some((mediaType) => mediaType === value);
}

function isPositiveId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isMediaContentId(
  value: unknown,
  mediaType: MediaType,
): value is number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value === 0
  ) {
    return false;
  }
  return value > 0 || mediaType === "advertisement" || mediaType === "toy";
}

function isOptionalId(value: unknown): value is number | null {
  return value === null || isPositiveId(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string";
}

function isOptionalText(value: unknown): value is string | null {
  return value === null || isText(value);
}

function isOptionalTimestamp(value: unknown): value is string | null {
  return (
    value === null || (isText(value) && Number.isFinite(Date.parse(value)))
  );
}

function isExpectedValues(value: unknown): value is WorkExpectedValues {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "actor_id",
      "character_id",
      "character_name",
      "voice_actor_id",
      "performance",
      "note",
      "highlight",
      "status",
    ]) ||
    !("actor_id" in value) ||
    !("character_id" in value) ||
    !("character_name" in value) ||
    !("voice_actor_id" in value) ||
    !("performance" in value) ||
    !("note" in value) ||
    !("highlight" in value) ||
    !("status" in value)
  ) {
    return false;
  }
  return (
    isOptionalId(value.actor_id) &&
    isOptionalId(value.character_id) &&
    isOptionalText(value.character_name) &&
    isOptionalId(value.voice_actor_id) &&
    isOptionalText(value.performance) &&
    isOptionalText(value.note) &&
    (value.highlight === null || typeof value.highlight === "boolean") &&
    isOptionalText(value.status)
  );
}

function parseCastRow(value: unknown, contentType: MediaType): CastSaveRow {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, [
      "id",
      "expected_updated_at",
      "expected",
      "actor_id",
      "character_id",
      "character_name",
      "voice_actor_id",
      "performance",
      "note",
      "highlight",
    ])
  ) {
    throw projectSaveError(400, "Invalid cast assignments");
  }

  const hasId = "id" in value;
  if (
    (hasId && !isPositiveId(value.id)) ||
    (hasId &&
      (!isOptionalTimestamp(value.expected_updated_at) ||
        !isExpectedValues(value.expected))) ||
    (!hasId && ("expected_updated_at" in value || "expected" in value)) ||
    ("actor_id" in value && !isOptionalId(value.actor_id)) ||
    ("character_id" in value && !isOptionalId(value.character_id)) ||
    ("voice_actor_id" in value && !isOptionalId(value.voice_actor_id)) ||
    ("character_name" in value && !isOptionalText(value.character_name)) ||
    ("performance" in value && !isOptionalText(value.performance)) ||
    ("note" in value && !isOptionalText(value.note)) ||
    ("highlight" in value &&
      value.highlight !== null &&
      typeof value.highlight !== "boolean") ||
    ("actor_id" in value && contentType !== "movie" && contentType !== "tv") ||
    ("character_id" in value && contentType !== "video_game")
  ) {
    throw projectSaveError(400, "Invalid or protected cast fields");
  }

  const row: CastSaveRow = {};
  if (hasId && isPositiveId(value.id)) {
    row.id = value.id;
    if (isOptionalTimestamp(value.expected_updated_at)) {
      row.expected_updated_at = value.expected_updated_at;
    }
    if (isExpectedValues(value.expected)) row.expected = value.expected;
  }
  if ("actor_id" in value && isOptionalId(value.actor_id))
    row.actor_id = value.actor_id;
  if ("character_id" in value && isOptionalId(value.character_id))
    row.character_id = value.character_id;
  if ("voice_actor_id" in value && isOptionalId(value.voice_actor_id))
    row.voice_actor_id = value.voice_actor_id;
  if ("character_name" in value && isOptionalText(value.character_name))
    row.character_name = value.character_name;
  if ("performance" in value && isOptionalText(value.performance))
    row.performance = value.performance;
  if ("note" in value && isOptionalText(value.note)) row.note = value.note;
  if (
    "highlight" in value &&
    (value.highlight === null || typeof value.highlight === "boolean")
  ) {
    row.highlight = value.highlight;
  }
  return row;
}

function parseBody(value: unknown): ProjectSaveBody {
  if (!isRecord(value)) {
    throw projectSaveError(400, "Invalid project save request");
  }
  if (
    !hasOnlyKeys(value, [
      "request_id",
      "project_id",
      "expected_updated_at",
      "project",
      "crew",
      "cast",
    ])
  ) {
    throw projectSaveError(400, "Invalid project save request");
  }

  if (
    !isText(value.request_id) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.request_id,
    ) ||
    !(value.project_id === null || isPositiveId(value.project_id)) ||
    !isOptionalTimestamp(value.expected_updated_at) ||
    !isRecord(value.project) ||
    !hasOnlyKeys(value.project, [
      "content_id",
      "content_type",
      "language",
      "studio_id",
      "status",
    ]) ||
    !Array.isArray(value.crew) ||
    !Array.isArray(value.cast)
  ) {
    throw projectSaveError(400, "Invalid project save request");
  }

  const project = value.project;
  const contentType = project.content_type;
  if (
    !isMediaType(contentType) ||
    !isMediaContentId(project.content_id, contentType) ||
    !isText(project.language) ||
    !isOptionalId(project.studio_id) ||
    !(
      project.status === "validated" ||
      project.status === "pending" ||
      project.status === "draft"
    )
  ) {
    throw projectSaveError(400, "Invalid project fields");
  }
  const contentId = project.content_id;
  const languageValue = project.language;
  const statusValue = project.status;
  const studioId = project.studio_id;

  const crew: CrewSaveRow[] = [];
  const crewJobs = new Set<number>();
  for (const item of value.crew) {
    if (
      !isRecord(item) ||
      !hasOnlyKeys(item, ["job_id", "person_id"]) ||
      !isPositiveId(item.job_id) ||
      !isPositiveId(item.person_id) ||
      crewJobs.has(item.job_id)
    ) {
      throw projectSaveError(400, "Invalid crew assignments");
    }
    crewJobs.add(item.job_id);
    crew.push({ job_id: item.job_id, person_id: item.person_id });
  }

  const cast: CastSaveRow[] = [];
  const castIds = new Set<number>();
  for (const item of value.cast) {
    const row = parseCastRow(item, contentType);
    if (row.id !== undefined && castIds.has(row.id)) {
      throw projectSaveError(400, "Duplicate cast row id");
    }
    if (row.id !== undefined) castIds.add(row.id);
    cast.push(row);
  }

  const requestId = value.request_id;
  const projectId = value.project_id;
  const expectedUpdatedAt = value.expected_updated_at;
  if (projectId === null && expectedUpdatedAt !== null) {
    throw projectSaveError(
      400,
      "New projects cannot include an update version",
    );
  }
  return {
    request_id: requestId,
    project_id: projectId,
    expected_updated_at: expectedUpdatedAt,
    project: {
      content_id: contentId,
      content_type: contentType,
      language: requireDubbingLanguage(languageValue),
      studio_id: studioId,
      status: statusValue,
    },
    crew,
    cast,
  };
}

function recordField(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

async function validateExternalReferences(body: ProjectSaveBody) {
  const { content_id: contentId, content_type: contentType } = body.project;

  if (contentType === "movie" || contentType === "tv") {
    try {
      const tmdbClient = useTmdbClient();
      const media = await tmdbClient.fetchMediaDetails(contentId, contentType);
      if (recordField(media, "id") !== contentId) {
        throw projectSaveError(
          422,
          "The selected media does not exist in TMDB",
        );
      }
      const credits =
        contentType === "tv"
          ? await tmdbClient.fetchMediaCredits("tv", contentId)
          : recordField(media, "credits");
      const cast = recordField(credits, "cast");
      const actorIds = new Set(
        Array.isArray(cast)
          ? cast.map((actor) => recordField(actor, "id")).filter(isPositiveId)
          : [],
      );
      for (const row of body.cast) {
        if (
          row.actor_id !== undefined &&
          row.actor_id !== null &&
          !actorIds.has(row.actor_id)
        ) {
          throw projectSaveError(
            422,
            "A selected actor does not belong to this media",
          );
        }
      }
    } catch (error) {
      if (error && typeof error === "object" && "statusCode" in error)
        throw error;
      const missing =
        error instanceof Error &&
        /(?:TMDB API error: 404|404)/.test(error.message);
      throw projectSaveError(
        missing ? 422 : 503,
        missing
          ? "The selected media does not exist in TMDB"
          : "TMDB could not verify this save; try again",
      );
    }
  } else if (contentType === "video_game") {
    try {
      const igdb = useIgdbClient();
      const game = await igdb.getGame(contentId);
      if (!game || game.id !== contentId) {
        throw projectSaveError(422, "The selected game does not exist in IGDB");
      }
      const requestedCharacterIds = body.cast.flatMap((row) =>
        row.character_id === undefined || row.character_id === null
          ? []
          : [row.character_id],
      );
      if (requestedCharacterIds.length > 0) {
        const characters = await igdb.getGameCharacters(contentId);
        const characterIds = new Set(
          characters.map((character) => character.id),
        );
        if (
          requestedCharacterIds.some(
            (characterId) => !characterIds.has(characterId),
          )
        ) {
          throw projectSaveError(
            422,
            "A selected character does not belong to this game",
          );
        }
      }
    } catch (error) {
      if (error && typeof error === "object" && "statusCode" in error)
        throw error;
      throw projectSaveError(503, "IGDB could not verify this save; try again");
    }
  } else if (contentType === "audiobook") {
    let book: Awaited<
      ReturnType<ReturnType<typeof useOpenLibraryClient>["getBook"]>
    >;
    try {
      book = await useOpenLibraryClient().getBook(contentId);
    } catch {
      throw projectSaveError(
        503,
        "Open Library could not verify this save; try again",
      );
    }
    if (!book || book.id !== contentId) {
      throw projectSaveError(
        422,
        "The selected audiobook does not exist in Open Library",
      );
    }
  } else if (contentType === "podcast") {
    let podcast: Awaited<
      ReturnType<ReturnType<typeof usePodcastClient>["getPodcast"]>
    >;
    try {
      podcast = await usePodcastClient().getPodcast(contentId);
    } catch {
      throw projectSaveError(
        503,
        "iTunes could not verify this save; try again",
      );
    }
    if (
      !podcast ||
      podcast.id !== contentId ||
      podcast.title === `Podcast #${contentId}`
    ) {
      throw projectSaveError(
        422,
        "The selected podcast does not exist in iTunes",
      );
    }
  }
}

export default defineEventHandler(async (event) => {
  const user = requireAdmin(event);
  const body = parseBody(await readBody(event));
  await validateExternalReferences(body);

  const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);
  const { data, error } = await supabase.rpc("save_dubbing_project_editor", {
    p_actor_id: user.id,
    p_request_id: body.request_id,
    p_project_id: body.project_id,
    p_expected_updated_at: body.expected_updated_at,
    p_project: body.project,
    p_crew: body.crew,
    p_cast: body.cast,
  });

  if (error) {
    if (error.code === "42501") {
      throw projectSaveError(403, "Project save is not authorized");
    }
    if (["55000", "23505", "40001", "40P01"].includes(error.code)) {
      throw projectSaveError(
        409,
        "Project data changed; reload before saving again",
      );
    }
    if (["22023", "23503", "22P02", "22003"].includes(error.code)) {
      throw projectSaveError(
        422,
        "Project, crew or cast references are invalid",
      );
    }
    console.error("Controlled project save failed", { code: error.code });
    throw projectSaveError(500, "Project save failed; no changes were saved");
  }

  const result = data?.[0];
  if (!result) {
    console.error("Controlled project save returned no result");
    throw projectSaveError(500, "Project save failed; no changes were saved");
  }

  return {
    success: true,
    projectId: result.project_id,
    updatedAt: result.updated_at,
    auditLogId: result.audit_log_id,
    replayed: result.replayed,
  };
});
