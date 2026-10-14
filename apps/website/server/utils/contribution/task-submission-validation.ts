export type TaskCategory = "enrich_voice_actor" | "enrich_studio";

export type TaskUpload = {
  filename?: string;
  type?: string;
  data: Buffer;
};

export type TaskContributionInput = {
  claimId: unknown;
  category: string;
  entityId: string;
  fields: Record<string, string>;
  currentValues: Record<string, unknown>;
  upload?: TaskUpload;
  role?: string | null;
};

export type TaskContribution = {
  entityId: number;
  updates: Record<string, string | number | Record<string, string>>;
  uploadTarget: string | null;
};

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const socialFields = ["twitter", "instagram", "tiktok", "facebook"] as const;

const contributionFields: Record<TaskCategory, readonly string[]> = {
  enrich_voice_actor: [
    "nationality",
    "date_of_birth",
    "bio",
    "tmdb_id",
    "wikidata_id",
    ...socialFields,
  ],
  enrich_studio: ["country", "city", "website_url", ...socialFields],
};

const uploadField: Record<TaskCategory, string> = {
  enrich_voice_actor: "profile_picture",
  enrich_studio: "logo_url",
};

function isTaskCategory(value: string): value is TaskCategory {
  return Object.hasOwn(contributionFields, value);
}

function assertHttpUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Invalid URL");
  }
  if (
    (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password
  ) {
    throw new Error("Invalid URL");
  }
}

function assertDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid date");
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Invalid date");
  }
}

function assertUpload(upload: TaskUpload): void {
  if (!Buffer.isBuffer(upload.data)) throw new Error("Invalid image upload");
  if (!upload.data.length || upload.data.length > MAX_UPLOAD_SIZE)
    throw new Error("Invalid upload size");
  const type = upload.type?.toLowerCase();
  const valid =
    (type === "image/png" &&
      upload.data.length >= 8 &&
      upload.data
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (type === "image/jpeg" &&
      upload.data.length >= 3 &&
      upload.data[0] === 0xff &&
      upload.data[1] === 0xd8 &&
      upload.data[2] === 0xff) ||
    (type === "image/webp" &&
      upload.data.length >= 12 &&
      upload.data.toString("ascii", 0, 4) === "RIFF" &&
      upload.data.toString("ascii", 8, 12) === "WEBP");
  if (!valid) throw new Error("Invalid image upload");
}

function assertEmpty(currentValue: unknown, allowMissing = false): void {
  if (currentValue === undefined && !allowMissing) throw new Error("Current value is required");
  if (currentValue !== null && currentValue !== undefined && currentValue !== "") {
    throw new Error("Contribution field is already populated");
  }
}

export function authorizeTaskContribution(input: {
  userId: string | null | undefined;
  role?: string | null;
  category: string;
  upload?: TaskUpload;
  currentUploadValue?: unknown;
}): void {
  if (!input.userId) throw new Error("Authentication required");
  if (!isTaskCategory(input.category)) throw new Error("Invalid category");
  if (input.upload) {
    const verifiedVoiceActorAdmin =
      input.category === "enrich_voice_actor" && input.role === "admin";
    if (input.currentUploadValue === undefined && !verifiedVoiceActorAdmin) {
      throw new Error("Current upload value is required");
    }
    if (verifiedVoiceActorAdmin) return;
    assertEmpty(input.currentUploadValue);
  }
}

export function validateTaskContribution(input: TaskContributionInput): TaskContribution {
  if (typeof input.claimId !== "string" || !input.claimId.trim() || input.claimId.length > 256) {
    throw new Error("Invalid claim id");
  }
  if (!isTaskCategory(input.category)) throw new Error("Invalid category");
  if (!/^[1-9]\d*$/.test(input.entityId)) throw new Error("Invalid entity id");
  const entityId = Number(input.entityId);
  if (!Number.isSafeInteger(entityId)) throw new Error("Invalid entity id");

  const allowed = new Set(contributionFields[input.category]);
  for (const field of Object.keys(input.fields)) {
    if (!allowed.has(field)) throw new Error("Unsupported contribution field");
  }
  if (input.upload) assertUpload(input.upload);
  const fileKey = uploadField[input.category];
  if (input.upload) {
    if (!Object.hasOwn(input.currentValues, fileKey)) throw new Error("Current value is required");
    const verifiedVoiceActorAdmin =
      input.category === "enrich_voice_actor" && input.role === "admin";
    if (!verifiedVoiceActorAdmin) assertEmpty(input.currentValues[fileKey]);
  }
  if (Object.keys(input.fields).length === 0 && !input.upload)
    throw new Error("No contribution provided");

  const updates: TaskContribution["updates"] = {};
  const socials: Record<string, string> = {};
  for (const [field, rawValue] of Object.entries(input.fields)) {
    if (typeof rawValue !== "string") throw new Error("Contribution fields must be strings");
    const value = rawValue.trim();
    if (!value) throw new Error("Contribution fields cannot be empty");
    if (value.length > 10_000) throw new Error("Contribution field is too long");
    if (socialFields.some((socialField) => socialField === field)) {
      if (!Object.hasOwn(input.currentValues, "social_media_links"))
        throw new Error("Current value is required");
      const existing = input.currentValues.social_media_links;
      if (existing !== null && (typeof existing !== "object" || Array.isArray(existing)))
        throw new Error("Invalid current social links");
      const links = typeof existing === "object" && existing !== null ? existing : {};
      assertEmpty(Reflect.get(links, field), true);
      assertHttpUrl(value);
      if (value.length > 2_048) throw new Error("Contribution URL is too long");
      socials[field] = value;
      continue;
    }
    if (!Object.hasOwn(input.currentValues, field)) throw new Error("Current value is required");
    assertEmpty(input.currentValues[field]);
    if (field === "date_of_birth") assertDate(value);
    if (field === "website_url") {
      assertHttpUrl(value);
      if (value.length > 2_048) throw new Error("Contribution URL is too long");
    }
    if (field === "tmdb_id") {
      if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)))
        throw new Error("Invalid TMDB id");
      updates[field] = Number(value);
      continue;
    }
    if (field === "wikidata_id" && !/^Q[1-9]\d*$/.test(value))
      throw new Error("Invalid Wikidata id");
    updates[field] = value;
  }
  if (Object.keys(socials).length) updates.social_media_links = socials;
  return { entityId, updates, uploadTarget: input.upload ? fileKey : null };
}
