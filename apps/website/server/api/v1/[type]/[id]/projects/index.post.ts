import * as v from "valibot";
import { defineApiRoute } from "../../../../../utils/api-v1/define";
import { errorCode, notifyCreditChange, requireMedia } from "../../../../../utils/api-v1/credits";
import { ApiError } from "../../../../../utils/api-v1/errors";
import { ProjectSummary } from "../../../../../utils/api-v1/projects";
import {
  dubbingLanguage,
  mediaKey,
  mediaParams,
  sitePath,
} from "../../../../../utils/api-v1/media";
import { useSupabaseAdmin } from "../../../../../utils/db/client";

const Created = v.object({
  project_id: v.number(),
  language: v.string(),
  audit_log_id: v.nullable(v.string()),
  replayed: v.boolean(),
});

export const route = defineApiRoute({
  summary: "Ensure a media entry has a dubbing project in a language",
  description:
    "Returns the existing project when the media already has one in this language. External media references are stored as supplied; no provider is called. A create reserves its Idempotency-Key: reusing that key with different project data conflicts. Looking up a project that already existed does not reserve the key.",
  tags: ["Projects"],
  scope: "credits:create",
  notFound: "A toy or advertisement must already exist in DubbingBase.",
  idempotent: true,
  params: mediaParams,
  query: v.object({}),
  body: v.strictObject({ language: dubbingLanguage }),
  response: v.object({ ...ProjectSummary.entries, replayed: v.boolean() }),
  handler: async ({ event, auth, params, body, idempotencyKey }) => {
    if (idempotencyKey === null)
      throw new ApiError(500, "internal_error", "Internal server error.");
    const key = mediaKey(params.type, params.id);
    if (key.contentType === "toy" || key.contentType === "advertisement")
      await requireMedia(event, key);

    const { data, error } = await (event.context.supabaseAdmin || useSupabaseAdmin(event)).rpc(
      "api_create_dubbing_project",
      {
        p_actor_id: auth.userId,
        p_request_id: idempotencyKey,
        p_content_id: key.contentId,
        p_content_type: key.contentType,
        p_language: body.language,
      },
    );
    if (error) {
      switch (errorCode(error)) {
        case "42501":
          throw new ApiError(403, "forbidden", "Not allowed to create dubbing projects.");
        case "23505":
        case "55000":
        case "40001":
        case "40P01":
        case "PT409":
          throw new ApiError(
            409,
            "conflict",
            "The project request conflicts with an earlier write; retry.",
          );
        case "22023":
        case "23503":
        case "22P02":
        case "22003":
          throw new ApiError(400, "invalid_request", "The project reference is invalid.");
        default:
          console.error("api_create_dubbing_project failed", errorCode(error));
          throw new ApiError(500, "internal_error", "Internal server error.");
      }
    }
    const createdRows = v.parse(v.pipe(v.array(Created), v.length(1)), data);
    const created = createdRows[0];
    if (!created) throw new ApiError(500, "internal_error", "Internal server error.");
    if (!created.replayed && created.audit_log_id !== null) {
      notifyCreditChange(event, auth.userId, {
        entityId: `${key.contentType}/${key.contentId}`,
        detail: `dubbing project for ${created.language} created`,
        path: sitePath(key.segment, key.contentId),
      });
    }
    return {
      id: created.project_id,
      language: created.language,
      path: `/api/v1/projects/${created.project_id}`,
      replayed: created.replayed,
    };
  },
});

export default route.handler;
