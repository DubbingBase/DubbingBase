import { eqMediaRef, MEDIA_FILTER_EMBED } from "@app/shared-logic";
import * as v from "valibot";
import { defineApiRoute } from "../../../../utils/api-v1/define";
import { MEDIA_NOT_FOUND_DESCRIPTION, requireMedia } from "../../../../utils/api-v1/credits";
import { mediaKey, mediaParams, apiMediaPath } from "../../../../utils/api-v1/media";
import { useSupabaseAdmin } from "../../../../utils/db/client";

export const route = defineApiRoute({
  summary: "Get a media entry",
  tags: ["Media"],
  scope: "credits:read",
  notFound: MEDIA_NOT_FOUND_DESCRIPTION,
  params: mediaParams,
  query: v.object({}),
  response: v.object({
    path: v.string(),
    type: v.string(),
    id: v.number(),
    /** Dubbing languages that have a project for this media. */
    languages: v.array(v.string()),
    /** Existing dubbing projects for this media. */
    projects: v.array(v.object({ id: v.number(), language: v.string(), path: v.string() })),
    links: v.object({ credits: v.string(), characters: v.string() }),
  }),
  handler: async ({ event, params }) => {
    const key = mediaKey(params.type, params.id);
    await requireMedia(event, key);
    const { data, error } = await eqMediaRef(
      useSupabaseAdmin(event)
        .from("dubbing_projects")
        .select(`id, language, ${MEDIA_FILTER_EMBED}`),
      key.contentType,
      key.contentId,
    ).order("language", { ascending: true });
    if (error) throw error;
    const path = apiMediaPath(key.segment, key.contentId);
    return {
      path,
      type: key.segment,
      id: params.id,
      languages: (data ?? []).map((project) => project.language),
      projects: (data ?? []).map((project) => ({
        id: project.id,
        language: project.language,
        path: `/api/v1/projects/${project.id}`,
      })),
      links: { credits: `${path}/credits`, characters: `${path}/characters` },
    };
  },
});

export default route.handler;
