import * as v from "valibot";
import { defineApiRoute } from "../../../utils/api-v1/define";
import { getProject, Project } from "../../../utils/api-v1/projects";
import { positiveId } from "../../../utils/api-v1/voice-actors";

export const route = defineApiRoute({
  summary: "Get a dubbing project",
  tags: ["Projects"],
  scope: "credits:read",
  notFound: "Dubbing project not found.",
  params: v.object({ projectId: positiveId }),
  query: v.object({}),
  response: Project,
  handler: ({ event, params }) => getProject(event, params.projectId),
});

export default route.handler;
