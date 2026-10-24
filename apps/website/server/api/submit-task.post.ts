import { createHash } from "node:crypto";
import { requireUser } from "../utils/auth";
import {
  authorizeTaskContribution,
  isTaskClaimId,
  validateTaskContribution,
  type TaskUpload,
} from "../utils/contribution/task-submission-validation";
import { useSupabaseAdmin } from "../utils/db/client";

type UploadLocation = {
  bucket: "voice_actor_profile_pictures" | "studio_logos";
  path: string;
};

type SubmissionSuccess = { success: true; pointsAwarded: number };

function statusCodeOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return;
  return typeof error.statusCode === "number" ? error.statusCode : undefined;
}

function messageOf(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return typeof error.message === "string" ? error.message : undefined;
  }
}

async function removeStagedUpload(
  supabaseAdmin: ReturnType<typeof useSupabaseAdmin>,
  upload: UploadLocation,
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.storage.from(upload.bucket).remove([upload.path]);
    if (error) console.error("Failed to remove staged contribution upload");
  } catch {
    console.error("Failed to remove staged contribution upload");
  }
}

function parseSubmission(parts: Awaited<ReturnType<typeof readMultipartFormData>>): {
  claimId: string;
  fields: Record<string, string>;
  upload?: TaskUpload;
} {
  if (!parts)
    throw createError({
      statusCode: 400,
      message: "Multipart form data is required",
    });

  let claimId: string | undefined;
  let upload: TaskUpload | undefined;
  const fields = new Map<string, string>();
  for (const part of parts) {
    if (!part.name) throw createError({ statusCode: 400, message: "Invalid form field" });
    if (part.name === "category" || part.name === "entityId") {
      throw createError({
        statusCode: 400,
        message: "Task details must come from the claim",
      });
    }
    if (!Buffer.isBuffer(part.data)) {
      throw createError({ statusCode: 400, message: "Invalid form field" });
    }
    if (part.name === "claimId") {
      if (claimId !== undefined || part.filename !== undefined) {
        throw createError({ statusCode: 400, message: "Invalid claim id" });
      }
      claimId = part.data.toString("utf8");
      continue;
    }
    if (part.name === "file") {
      if (upload)
        throw createError({
          statusCode: 400,
          message: "Only one image is allowed",
        });
      upload = {
        data: part.data,
        ...(part.filename === undefined ? {} : { filename: part.filename }),
        ...(part.type === undefined ? {} : { type: part.type }),
      };
      continue;
    }
    if (part.filename !== undefined || fields.has(part.name)) {
      throw createError({
        statusCode: 400,
        message: "Invalid or duplicate contribution field",
      });
    }
    fields.set(part.name, part.data.toString("utf8"));
  }

  if (!isTaskClaimId(claimId)) throw createError({ statusCode: 400, message: "Invalid claim id" });
  return {
    claimId,
    fields: Object.fromEntries(fields),
    ...(upload ? { upload } : {}),
  };
}

function fingerprintSubmission(input: ReturnType<typeof parseSubmission>): string {
  const fields = Object.entries(input.fields).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  const upload = input.upload
    ? {
        contentType: input.upload.type?.toLowerCase() ?? null,
        sha256: createHash("sha256").update(input.upload.data).digest("hex"),
      }
    : null;

  return createHash("sha256")
    .update(JSON.stringify({ claimId: input.claimId, fields, upload }))
    .digest("hex");
}

function imageTypeFor(value: string | undefined): {
  contentType: "image/jpeg" | "image/png" | "image/webp";
  extension: "jpg" | "png" | "webp";
} {
  const contentType = value?.toLowerCase();
  if (contentType === "image/jpeg") return { contentType, extension: "jpg" };
  if (contentType === "image/png") return { contentType, extension: "png" };
  if (contentType === "image/webp") return { contentType, extension: "webp" };
  throw createError({ statusCode: 415, message: "Unsupported image type" });
}

async function recoverSubmittedContribution(
  supabaseAdmin: ReturnType<typeof useSupabaseAdmin>,
  claimId: string,
  userId: string,
  isAdmin: boolean,
  submissionFingerprint: string,
): Promise<SubmissionSuccess | null> {
  const { data, error } = await supabaseAdmin.rpc(
    "submit_gamification_task_contribution_retry_safe",
    {
      p_claim_id: claimId,
      p_user_id: userId,
      p_updates: {},
      p_is_admin: isAdmin,
      p_submission_fingerprint: submissionFingerprint,
    },
  );
  if (error || !data?.[0]) {
    console.error("Failed to recover contribution submission");
    throw createError({
      statusCode: 500,
      message: "Unable to verify contribution retry",
    });
  }

  const replay = data[0];
  if (replay.status !== "submitted" || !replay.replayed) return null;
  if (!Number.isSafeInteger(replay.points_awarded) || replay.points_awarded < 0) {
    console.error("Contribution retry returned invalid points");
    throw createError({
      statusCode: 500,
      message: "Unable to verify contribution retry",
    });
  }
  return { success: true, pointsAwarded: replay.points_awarded };
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const supabaseAdmin = event.context.supabaseAdmin || useSupabaseAdmin(event);
  let stagedUpload: UploadLocation | null = null;
  let preserveStagedUpload = false;

  try {
    const input = parseSubmission(await readMultipartFormData(event));
    const submissionFingerprint = fingerprintSubmission(input);
    const role = user.app_metadata?.role === "admin" ? "admin" : null;
    const replaySubmitted = () =>
      recoverSubmittedContribution(
        supabaseAdmin,
        input.claimId,
        user.id,
        role === "admin",
        submissionFingerprint,
      );
    const { data: claim, error: claimError } = await supabaseAdmin
      .from("gamification_task_locks")
      .select("claim_id, category, entity_id, expires_at, consumed_at")
      .eq("claim_id", input.claimId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (claimError) {
      const replay = await replaySubmitted();
      if (replay) return replay;
      console.error("Failed to verify contribution claim");
      throw createError({
        statusCode: 500,
        message: "Unable to verify contribution claim",
      });
    }
    if (!claim) {
      const replay = await replaySubmitted();
      if (replay) return replay;
      throw createError({
        statusCode: 409,
        message: "Contribution claim is no longer valid",
      });
    }

    if (claim.consumed_at !== null) {
      const replay = await replaySubmitted();
      if (!replay) {
        throw createError({
          statusCode: 409,
          message: "Contribution claim is no longer valid",
        });
      }
      return replay;
    }

    if (
      !Number.isFinite(Date.parse(claim.expires_at)) ||
      Date.parse(claim.expires_at) <= Date.now()
    ) {
      throw createError({
        statusCode: 409,
        message: "Contribution claim is no longer valid",
      });
    }

    const category = claim.category;
    if (category !== "enrich_voice_actor" && category !== "enrich_studio") {
      throw createError({
        statusCode: 409,
        message: "Contribution claim is no longer valid",
      });
    }
    if (!/^[1-9][0-9]*$/.test(claim.entity_id)) {
      throw createError({
        statusCode: 409,
        message: "Contribution claim is no longer valid",
      });
    }
    const entityId = Number(claim.entity_id);
    if (!Number.isSafeInteger(entityId)) {
      throw createError({
        statusCode: 409,
        message: "Contribution claim is no longer valid",
      });
    }

    let currentValues: Record<string, unknown>;
    if (category === "enrich_voice_actor") {
      const { data: actor, error: actorError } = await supabaseAdmin
        .from("voice_actors")
        .select(
          "profile_picture, nationality, date_of_birth, bio, tmdb_id, wikidata_id, social_media_links",
        )
        .eq("id", entityId)
        .maybeSingle();
      if (actorError) {
        console.error("Failed to read contribution target");
        throw createError({
          statusCode: 500,
          message: "Unable to verify contribution target",
        });
      }
      if (!actor)
        throw createError({
          statusCode: 409,
          message: "Contribution target changed",
        });
      currentValues = {
        profile_picture: actor.profile_picture,
        nationality: actor.nationality,
        date_of_birth: actor.date_of_birth,
        bio: actor.bio,
        tmdb_id: actor.tmdb_id,
        wikidata_id: actor.wikidata_id,
        social_media_links: actor.social_media_links,
      };
    } else {
      const { data: studio, error: studioError } = await supabaseAdmin
        .from("studios")
        .select("logo_url, country, city, website_url, social_media_links")
        .eq("id", entityId)
        .maybeSingle();
      if (studioError) {
        console.error("Failed to read contribution target");
        throw createError({
          statusCode: 500,
          message: "Unable to verify contribution target",
        });
      }
      if (!studio)
        throw createError({
          statusCode: 409,
          message: "Contribution target changed",
        });
      currentValues = {
        logo_url: studio.logo_url,
        country: studio.country,
        city: studio.city,
        website_url: studio.website_url,
        social_media_links: studio.social_media_links,
      };
    }

    if (input.upload) {
      const uploadTarget = category === "enrich_voice_actor" ? "profile_picture" : "logo_url";
      try {
        authorizeTaskContribution({
          userId: user.id,
          role,
          category,
          upload: input.upload,
          currentUploadValue: currentValues[uploadTarget],
        });
      } catch {
        const replay = await replaySubmitted();
        if (replay) return replay;
        const currentUploadValue = currentValues[uploadTarget];
        if (
          category === "enrich_voice_actor" &&
          role !== "admin" &&
          currentUploadValue !== null &&
          currentUploadValue !== ""
        ) {
          throw createError({
            statusCode: 403,
            message: "Only admins can replace a voice actor picture",
          });
        }
        throw createError({
          statusCode: 409,
          message: "Contribution image field is already populated",
        });
      }
    }

    let contribution: ReturnType<typeof validateTaskContribution>;
    try {
      contribution = validateTaskContribution({
        claimId: input.claimId,
        category,
        entityId: claim.entity_id,
        fields: input.fields,
        currentValues,
        ...(input.upload ? { upload: input.upload } : {}),
        role,
      });
    } catch (error) {
      const replay = await replaySubmitted();
      if (replay) return replay;
      const validationMessage = messageOf(error);
      if (validationMessage === "Contribution field is already populated") {
        throw createError({
          statusCode: 409,
          message: "Contribution field is already populated",
        });
      }
      if (validationMessage === "Current value is required") {
        throw createError({
          statusCode: 409,
          message: "Contribution target changed",
        });
      }
      if (validationMessage === "Invalid upload size") {
        throw createError({
          statusCode: 413,
          message: "Contribution image exceeds 5 MiB",
        });
      }
      if (validationMessage === "Invalid image upload") {
        throw createError({
          statusCode: 415,
          message: "Unsupported image type",
        });
      }
      throw createError({
        statusCode: 400,
        message: "Invalid contribution fields",
      });
    }

    if (input.upload && contribution.uploadTarget) {
      const bucket =
        category === "enrich_voice_actor" ? "voice_actor_profile_pictures" : "studio_logos";
      const imageType = imageTypeFor(input.upload.type);
      const uploadId = [
        submissionFingerprint.slice(0, 8),
        submissionFingerprint.slice(8, 12),
        submissionFingerprint.slice(12, 16),
        submissionFingerprint.slice(16, 20),
        submissionFingerprint.slice(20, 32),
      ].join("-");
      const path = `${entityId}/${uploadId}.${imageType.extension}`;
      stagedUpload = { bucket, path };
      preserveStagedUpload = true;
      const { data: uploaded, error: uploadError } = await supabaseAdmin.storage
        .from(bucket)
        .upload(path, input.upload.data, {
          contentType: imageType.contentType,
          upsert: true,
        });
      if (uploadError || !uploaded) {
        console.error("Failed to upload contribution image");
        throw createError({
          statusCode: 502,
          message: "Contribution image upload failed",
        });
      }
      stagedUpload = { bucket, path: uploaded.path };
      contribution.updates[contribution.uploadTarget] = uploaded.path;
    }

    const submitContribution = () =>
      supabaseAdmin.rpc("submit_gamification_task_contribution_retry_safe", {
        p_claim_id: input.claimId,
        p_user_id: user.id,
        p_updates: contribution.updates,
        p_is_admin: role === "admin",
        p_submission_fingerprint: submissionFingerprint,
      });
    let submissionResult = await submitContribution();
    if (submissionResult.error) {
      console.error("Atomic contribution submission failed; retrying once");
      submissionResult = await submitContribution();
    }
    if (submissionResult.error) {
      // The first call may have committed even though its response was lost.
      // Keep the shared object so a successful concurrent attempt cannot lose it.
      throw createError({
        statusCode: 500,
        message: "Unable to submit contribution",
      });
    }

    const submission = submissionResult.data?.[0];
    if (!submission) {
      console.error("Atomic contribution submission returned no result");
      throw createError({
        statusCode: 500,
        message: "Unable to submit contribution",
      });
    }
    if (submission.status === "invalid_claim") {
      preserveStagedUpload = false;
      throw createError({
        statusCode: 409,
        message: "Contribution claim is no longer valid",
      });
    }
    if (submission.status === "stale_task") {
      preserveStagedUpload = false;
      throw createError({
        statusCode: 409,
        message: "Contribution target changed",
      });
    }
    if (submission.status === "forbidden") {
      preserveStagedUpload = false;
      throw createError({
        statusCode: 403,
        message: "Only admins can replace a voice actor picture",
      });
    }
    if (submission.status !== "submitted") {
      console.error("Atomic contribution submission returned an invalid result");
      throw createError({
        statusCode: 500,
        message: "Unable to submit contribution",
      });
    }
    if (!Number.isSafeInteger(submission.points_awarded) || submission.points_awarded < 0) {
      console.error("Atomic contribution submission returned invalid points");
      throw createError({
        statusCode: 500,
        message: "Unable to submit contribution",
      });
    }
    // Identical concurrent retries use the same content-addressed object path.
    // Keep it on replay because the winning submission already references it.
    stagedUpload = null;
    return { success: true, pointsAwarded: submission.points_awarded };
  } catch (error) {
    if (stagedUpload && !preserveStagedUpload) {
      await removeStagedUpload(supabaseAdmin, stagedUpload);
    }
    if (statusCodeOf(error) !== undefined) throw error;
    console.error("Unexpected contribution submission failure");
    throw createError({
      statusCode: 500,
      message: "Unable to submit contribution",
    });
  }
});
