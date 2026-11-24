import * as v from "valibot";
import { defineApiRoute } from "../../../utils/api-v1/define";
import { errorCode, notifyCreditChange } from "../../../utils/api-v1/credits";
import { ApiError } from "../../../utils/api-v1/errors";
import {
  dubbingLanguage,
  internalSegment,
  apiMediaPath,
  sitePath,
} from "../../../utils/api-v1/media";
import { useSupabaseAdmin } from "../../../utils/db/client";

const optionalText = v.optional(v.nullable(v.pipe(v.string(), v.trim(), v.maxLength(2000))), null);

export const route = defineApiRoute({
  summary: "Create an advertisement or toy",
  tags: ["Media"],
  scope: "credits:create",
  idempotent: true,
  params: v.object({ type: internalSegment }),
  query: v.object({}),
  body: v.strictObject({
    name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(300)),
    /** The first dubbing language of the entry. */
    language: dubbingLanguage,
    brand: optionalText,
    manufacturer: optionalText,
    description: optionalText,
    /** Toys only. */
    product_line: optionalText,
    /** Toys only. */
    release_year: v.optional(
      v.nullable(v.pipe(v.number(), v.integer(), v.minValue(1800), v.maxValue(2200))),
      null,
    ),
  }),
  response: v.object({ path: v.string(), replayed: v.boolean() }),
  handler: async ({ event, auth, params, body, idempotencyKey }) => {
    if (idempotencyKey === null)
      throw new ApiError(500, "internal_error", "Internal server error.");
    const isAd = params.type === "advertisements";
    if (isAd && (body.product_line !== null || body.release_year !== null)) {
      throw new ApiError(400, "invalid_request", "Advertisements have no product line or year.");
    }
    const { data, error } = await (event.context.supabaseAdmin || useSupabaseAdmin(event)).rpc(
      "api_create_internal_media",
      {
        p_actor_id: auth.userId,
        p_request_id: idempotencyKey,
        p_media_type: isAd ? "advertisement" : "toy",
        p_language: body.language,
        p_name: body.name,
        p_brand: body.brand,
        p_manufacturer: body.manufacturer,
        p_product_line: body.product_line,
        p_release_year: body.release_year,
        p_description: body.description,
      },
    );
    if (error) {
      switch (errorCode(error)) {
        case "42501":
          throw new ApiError(403, "forbidden", "Not allowed to create this entry.");
        case "55000":
        case "23505":
        case "40001":
        case "PT409":
          throw new ApiError(409, "conflict", "The entry conflicts with an existing one; retry.");
        case "22023":
        case "23503":
        case "22P02":
        case "22003":
          throw new ApiError(422, "invalid_request", "The entry is invalid.");
        default:
          console.error("api_create_internal_media failed", errorCode(error));
          throw new ApiError(500, "internal_error", "Internal server error.");
      }
    }
    const [created] = v.parse(
      v.pipe(v.array(v.object({ content_id: v.number(), replayed: v.boolean() })), v.length(1)),
      data,
    );
    if (created && !created.replayed) {
      notifyCreditChange(event, auth.userId, {
        entityId: `${params.type}/${created.content_id}`,
        detail: `${isAd ? "advertisement" : "toy"} "${body.name}" created`,
        path: sitePath(params.type, created.content_id),
      });
    }
    return {
      path: apiMediaPath(params.type, created?.content_id ?? 0),
      replayed: created?.replayed ?? false,
    };
  },
});

export default route.handler;
