import type { H3Event } from "h3";
import * as v from "valibot";
import { ApiError } from "./errors";
import { apiMediaPath, mediaSegment, segmentOf } from "./media";
import { useSupabaseAdmin } from "../db/client";

export const Project = v.object({
  id: v.number(),
  path: v.string(),
  language: v.string(),
  studio_id: v.nullable(v.number()),
  status: v.nullable(v.string()),
  media: v.object({ path: v.string(), type: mediaSegment, id: v.number() }),
});

export const ProjectSummary = v.object({
  id: v.number(),
  language: v.string(),
  path: v.string(),
});

export const PROJECT_SELECT = "id, language, studio_id, status, media:media_id(kind, content_id)";

const ProjectRow = v.object({
  id: v.number(),
  language: v.string(),
  studio_id: v.nullable(v.number()),
  status: v.nullable(v.string()),
  media: v.nullable(v.object({ kind: v.string(), content_id: v.number() })),
});

export type ProjectOutput = v.InferOutput<typeof Project>;

export function toProject(row: v.InferOutput<typeof ProjectRow>): ProjectOutput {
  const segment = row.media ? segmentOf(row.media.kind) : null;
  if (!row.media || !segment) throw new Error("Dubbing project has an unsupported media reference");
  return {
    id: row.id,
    path: `/api/v1/projects/${row.id}`,
    language: row.language,
    studio_id: row.studio_id,
    status: row.status,
    media: {
      path: apiMediaPath(segment, row.media.content_id),
      type: segment,
      id: row.media.content_id,
    },
  };
}

export async function getProject(event: H3Event, projectId: number): Promise<ProjectOutput> {
  const { data, error } = await useSupabaseAdmin(event)
    .from("dubbing_projects")
    .select(PROJECT_SELECT)
    .eq("id", projectId)
    .maybeSingle();
  if (error) throw error;
  const row = v.parse(v.nullable(ProjectRow), data);
  if (!row) throw new ApiError(404, "not_found", "Dubbing project not found.");
  return toProject(row);
}
