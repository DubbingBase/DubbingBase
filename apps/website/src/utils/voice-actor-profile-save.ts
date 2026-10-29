import type { Json, Tables } from "@app/supabase/types";
import type { VoiceActorCreationPayload } from "../composables/useMetadataCreation";
import { createStableRequestIdFactory } from "./dubbing-project-save";

// The database client omits the computed voice_actor_name field for select('*').
export type VoiceActorProfile = Omit<Tables<"voice_actors">, "voice_actor_name">;

export interface DisplayedSocialLinks {
  instagram: string;
  twitter: string;
  tiktok: string;
  facebook: string;
  website: string;
}

export interface VoiceActorProfileSaveRequest {
  voice_actor_id: number;
  expected_updated_at: string;
  updates: Record<string, Json>;
}

export interface PendingVoiceActorCreation {
  payload: VoiceActorCreationPayload;
  requestId: string;
  createdProfile: VoiceActorProfile | null;
  conflicted: boolean;
}

type VoiceActorProfileSaveTransport = (
  request: VoiceActorProfileSaveRequest & { request_id: string },
) => Promise<{ profile: VoiceActorProfile }>;

function stableValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableValue(Reflect.get(value, key))}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function payloadFields(payload: VoiceActorCreationPayload): Record<string, Json | undefined> {
  return {
    firstname: payload.firstname,
    lastname: payload.lastname,
    bio: payload.bio,
    nationality: payload.nationality,
    date_of_birth: payload.date_of_birth,
    awards: payload.awards,
    years_active: payload.years_active,
    social_media_links: payload.social_media_links,
    profile_picture: payload.profile_picture,
    tmdb_id: payload.tmdb_id,
    wikidata_id: payload.wikidata_id,
    status: payload.status,
  };
}

export function voiceActorProfilePayload(profile: VoiceActorProfile): VoiceActorCreationPayload {
  return {
    firstname: profile.firstname,
    lastname: profile.lastname,
    bio: profile.bio || null,
    nationality: profile.nationality || null,
    date_of_birth: profile.date_of_birth || null,
    awards: profile.awards || null,
    years_active: profile.years_active || null,
    social_media_links: profile.social_media_links,
    profile_picture: profile.profile_picture || null,
    tmdb_id: profile.tmdb_id || null,
    wikidata_id: profile.wikidata_id || null,
  };
}

export function changedVoiceActorProfileFields(
  previous: VoiceActorCreationPayload,
  current: VoiceActorCreationPayload,
): Record<string, Json> {
  const before = payloadFields(previous);
  const updates: Record<string, Json> = {};
  for (const [field, value] of Object.entries(payloadFields(current))) {
    if (value !== undefined && stableValue(before[field]) !== stableValue(value)) {
      updates[field] = value;
    }
  }
  return updates;
}

export function displayedSocialLinks(value: Json | null): DisplayedSocialLinks {
  const links: { [key: string]: Json | undefined } =
    typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
  const text = (key: string): string => {
    const entry = links[key];
    return typeof entry === "string" ? entry : "";
  };
  return {
    instagram: text("instagram"),
    twitter: text("twitter"),
    tiktok: text("tiktok"),
    facebook: text("facebook"),
    website: text("website"),
  };
}

export function mergeDisplayedSocialLinks(
  original: Json | null,
  displayed: DisplayedSocialLinks,
): Json | null {
  const links: { [key: string]: Json | undefined } =
    typeof original === "object" && original !== null && !Array.isArray(original)
      ? { ...original }
      : {};
  let changed = false;
  for (const [key, value] of Object.entries(displayed)) {
    const previous = typeof links[key] === "string" ? links[key] : "";
    if (previous === value) continue;
    changed = true;
    if (value.trim()) links[key] = value;
    else delete links[key];
  }
  return changed ? links : original;
}

export function profileUnchangedExceptPicture(
  before: VoiceActorProfile,
  after: VoiceActorProfile,
): boolean {
  const ignored = new Set(["profile_picture", "updated_at", "updated_by"]);
  const comparable = (profile: VoiceActorProfile) =>
    Object.fromEntries(Object.entries(profile).filter(([key]) => !ignored.has(key)));
  return stableValue(comparable(before)) === stableValue(comparable(after));
}

export async function refreshVoiceActorProfilePicture(
  before: VoiceActorProfile,
  uploadedPath: string,
  getProfile: (id: number) => Promise<VoiceActorProfile>,
): Promise<VoiceActorProfile> {
  let refreshed: VoiceActorProfile;
  try {
    refreshed = await getProfile(before.id);
  } catch (cause) {
    throw new VoiceActorProfileRefreshError(cause);
  }
  if (
    refreshed.profile_picture !== uploadedPath ||
    !profileUnchangedExceptPicture(before, refreshed)
  ) {
    throw new VoiceActorProfileConflict();
  }
  return refreshed;
}

export function assertVoiceActorCreationCanSave(pending: PendingVoiceActorCreation): void {
  if (pending.conflicted) throw new VoiceActorProfileConflict();
}

export async function refreshVoiceActorCreationProfilePicture(
  pending: PendingVoiceActorCreation,
  before: VoiceActorProfile,
  uploadedPath: string,
  getProfile: (id: number) => Promise<VoiceActorProfile>,
): Promise<VoiceActorProfile> {
  let refreshed: VoiceActorProfile;
  try {
    refreshed = await refreshVoiceActorProfilePicture(before, uploadedPath, getProfile);
  } catch (error) {
    if (error instanceof VoiceActorProfileConflict) pending.conflicted = true;
    throw error;
  }
  pending.createdProfile = refreshed;
  pending.payload = { ...pending.payload, profile_picture: uploadedPath };
  return refreshed;
}

export function createVoiceActorProfileSaveClient(
  transport: VoiceActorProfileSaveTransport,
  randomUUID?: () => string,
) {
  const requestIds = createStableRequestIdFactory(randomUUID);
  return async (request: VoiceActorProfileSaveRequest): Promise<VoiceActorProfile> => {
    if (Object.keys(request.updates).length === 0) throw new Error("No profile changes to save");
    const response = await transport({
      ...request,
      request_id: requestIds.forPayload(request),
    });
    if (!response.profile || typeof response.profile.updated_at !== "string") {
      throw new Error("Voice actor update returned an invalid version");
    }
    requestIds.clear();
    return response.profile;
  };
}

function readProperty(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
}

export function isVoiceActorProfileConflict(error: unknown): boolean {
  return (
    readProperty(error, "statusCode") === 409 ||
    readProperty(error, "status") === 409 ||
    readProperty(readProperty(error, "data"), "statusCode") === 409
  );
}

export class VoiceActorProfileConflict extends Error {
  readonly statusCode = 409;
}

export class VoiceActorProfileRefreshError extends Error {
  constructor(cause: unknown) {
    super("Failed to refresh voice actor profile after picture upload", {
      cause,
    });
  }
}
