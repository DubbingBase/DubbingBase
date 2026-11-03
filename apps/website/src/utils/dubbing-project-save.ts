export type DubbingProjectMediaType =
  | "movie"
  | "tv"
  | "video_game"
  | "audiobook"
  | "podcast"
  | "advertisement"
  | "toy";

export type DubbingProjectStatus = "validated" | "pending" | "draft";

export function getEditableDubbingProjectStatus(value: string | null): DubbingProjectStatus {
  if (value === "validated" || value === "pending" || value === "draft") return value;
  return "validated";
}

export interface WorkExpectedValues {
  actor_id: number | null;
  character_id: number | null;
  game_character_id?: string | null;
  character_name: string | null;
  voice_actor_id: number | null;
  performance: string | null;
  note: string | null;
  highlight: boolean | null;
  status: string | null;
}

export interface DubbingProjectCastSaveRow {
  id?: number;
  expected_updated_at?: string | null;
  expected?: WorkExpectedValues;
  actor_id?: number | null;
  character_id?: number | null;
  game_character_id?: string | null;
  character_name?: string | null;
  voice_actor_id?: number | null;
  performance?: string | null;
  note?: string | null;
  highlight?: boolean | null;
}

export interface GameProjectCastEditorRow {
  id?: number;
  character_ref: number | string | null;
  character_id: number | string | null;
  game_character_id?: string | null;
  character_name: string;
  voice_actor_id: number | null;
  performance: string;
  note: string;
  highlight: boolean;
  expectedUpdatedAt?: string | null;
  expected?: WorkExpectedValues;
}

export function serializeGameProjectCastRows(
  rows: readonly GameProjectCastEditorRow[],
): DubbingProjectCastSaveRow[] {
  return rows.flatMap((row) => {
    if (!row.voice_actor_id && !row.character_name) return [];
    if (
      row.id !== undefined &&
      (row.expected === undefined || row.expectedUpdatedAt === undefined)
    ) {
      throw new Error("Reload this project before saving its cast.");
    }

    const selectedCharacter = row.character_ref ?? row.character_id;
    const isCustom =
      typeof selectedCharacter === "string" && selectedCharacter.startsWith("custom_");
    const hasNoProviderCharacter = !row.character_id;

    return [
      {
        ...(row.id === undefined
          ? {}
          : {
              id: row.id,
              expected_updated_at: row.expectedUpdatedAt,
              expected: row.expected,
            }),
        character_id: isCustom || hasNoProviderCharacter ? null : Number(row.character_id),
        character_name:
          row.game_character_id || isCustom || hasNoProviderCharacter
            ? row.character_name || null
            : null,
        game_character_id: row.game_character_id ?? null,
        voice_actor_id: row.voice_actor_id || null,
        performance: row.performance || "dialogues",
        note: row.note || null,
        highlight: row.highlight ? true : false,
      },
    ];
  });
}

export interface DubbingProjectSaveRequest {
  project_id: number | null;
  expected_updated_at: string | null;
  project: {
    content_id: number;
    content_type: DubbingProjectMediaType;
    language: string;
    studio_id: number | null;
    status: string;
  };
  crew: Array<{ job_id: number; person_id: number }>;
  cast: DubbingProjectCastSaveRow[];
}

export interface DubbingProjectSaveResponse {
  success: true;
  projectId: number;
  updatedAt: string | null;
  auditLogId: string;
  replayed: boolean;
}

export type DubbingProjectSaveTransport = (
  request: DubbingProjectSaveRequest & { request_id: string },
) => Promise<DubbingProjectSaveResponse>;

function createRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function createStableRequestIdFactory(randomUUID: () => string = createRequestId) {
  let previousPayload: string | null = null;
  let previousRequestId: string | null = null;

  return {
    forPayload(payload: unknown) {
      const fingerprint = JSON.stringify(payload);
      if (fingerprint !== previousPayload || previousRequestId === null) {
        previousPayload = fingerprint;
        previousRequestId = randomUUID();
      }
      return previousRequestId;
    },
    clear() {
      previousPayload = null;
      previousRequestId = null;
    },
  };
}

export function createDubbingProjectSaveClient(
  transport: DubbingProjectSaveTransport,
  randomUUID: () => string = createRequestId,
) {
  const requestIds = createStableRequestIdFactory(randomUUID);

  return async (request: DubbingProjectSaveRequest) => {
    const response = await transport({
      ...request,
      request_id: requestIds.forPayload(request),
    });
    requestIds.clear();
    return response;
  };
}

function readProperty(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  return Reflect.get(value, key);
}

export function isDubbingProjectSaveConflict(error: unknown): boolean {
  const status = readProperty(error, "statusCode") ?? readProperty(error, "status");
  const dataStatus = readProperty(readProperty(error, "data"), "statusCode");
  return status === 409 || dataStatus === 409;
}

export function getDubbingProjectSaveErrorMessage(error: unknown): string {
  const data = readProperty(error, "data");
  const dataMessage = readProperty(data, "statusMessage") ?? readProperty(data, "message");
  const message = readProperty(error, "statusMessage") ?? readProperty(error, "message");
  if (isDubbingProjectSaveConflict(error)) {
    return "This project changed in another editor. Your changes are still here; reload before saving again.";
  }
  if (typeof dataMessage === "string") return dataMessage;
  if (typeof message === "string") return message;
  return "Project save failed. Your changes are still here.";
}
