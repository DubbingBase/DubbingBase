import * as v from "valibot";
import { defineApiRoute } from "../../../utils/api-v1/define";
import { errorCode, notifyCreditChange } from "../../../utils/api-v1/credits";
import { ApiError } from "../../../utils/api-v1/errors";
import { Project, toProject } from "../../../utils/api-v1/projects";
import { sitePath } from "../../../utils/api-v1/media";
import { useSupabaseAdmin } from "../../../utils/db/client";
import { positiveId } from "../../../utils/api-v1/voice-actors";

const Status = v.picklist(["validated", "pending", "draft"]);
const Update = v.pipe(
  v.strictObject({
    status: v.optional(Status),
    studio_id: v.optional(
      v.nullable(
        v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(Number.MAX_SAFE_INTEGER)),
      ),
    ),
  }),
  v.check((updates) => Object.keys(updates).length > 0, "send status and/or studio_id"),
);

const UpdateResult = v.object({
  id: v.number(),
  language: v.string(),
  studio_id: v.nullable(v.number()),
  status: v.nullable(v.string()),
  replayed: v.boolean(),
  changed: v.boolean(),
  media: v.object({ kind: v.string(), content_id: v.number() }),
});

export const route = defineApiRoute({
  summary: "Change a project's status and/or studio",
  description:
    "Only status and studio_id are editable. Status accepts validated, pending, or draft; studio_id must name an existing studio or be null. Sending the same values is safe and does not change the project timestamp. Retrying with the same Idempotency-Key replays the audited result; a later project edit makes the retry conflict.",
  tags: ["Projects"],
  scope: "credits:update",
  idempotent: true,
  params: v.object({ projectId: positiveId }),
  query: v.object({}),
  body: Update,
  notFound: "Dubbing project not found.",
  response: v.object({ ...Project.entries, replayed: v.boolean() }),
  handler: async ({ event, auth, params, body, idempotencyKey }) => {
    if (idempotencyKey === null)
      throw new ApiError(500, "internal_error", "Internal server error.");
    const updates = {
      ...(body.status === undefined ? {} : { status: body.status }),
      ...(body.studio_id === undefined ? {} : { studio_id: body.studio_id }),
    };
    const { data, error } = await (event.context.supabaseAdmin || useSupabaseAdmin(event)).rpc(
      "api_update_dubbing_project",
      {
        p_actor_id: auth.userId,
        p_request_id: idempotencyKey,
        p_project_id: params.projectId,
        p_updates: updates,
      },
    );
    if (error) {
      switch (errorCode(error)) {
        case "42501":
          throw new ApiError(403, "forbidden", "Not allowed to update dubbing projects.");
        case "P0002":
          throw new ApiError(404, "not_found", "Dubbing project not found.");
        case "23505":
        case "55000":
        case "40001":
        case "40P01":
        case "PT409":
          throw new ApiError(
            409,
            "conflict",
            "The project changed or the idempotency key was reused; reload and retry.",
          );
        case "22023":
        case "23503":
        case "22P02":
        case "22003":
          throw new ApiError(400, "invalid_request", "The project update is invalid.");
        default:
          console.error("api_update_dubbing_project failed", errorCode(error));
          throw new ApiError(500, "internal_error", "Internal server error.");
      }
    }
    const result = v.parse(UpdateResult, data);
    const project = toProject(result);
    if (result.changed && !result.replayed) {
      notifyCreditChange(event, auth.userId, {
        entityId: `${result.media.kind}/${result.media.content_id}`,
        detail: `dubbing project #${result.id} updated`,
        path: sitePath(project.media.type, result.media.content_id),
      });
    }
    return {
      ...project,
      replayed: result.replayed,
    };
  },
});

export default route.handler;
