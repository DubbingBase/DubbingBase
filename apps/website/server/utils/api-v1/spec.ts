import manifest from "#api-v1-manifest";
import { API_SCOPES } from "../../../shared/api-scopes";
import { operationFor, type ApiRouteDocs, type SchemaComponents } from "./define";

export function buildOpenApiSpec() {
  const paths: Record<string, Record<string, unknown>> = {};
  const schemas: SchemaComponents = {};
  for (const { route, method, module } of manifest) {
    const docs: ApiRouteDocs | undefined = module.route?.docs;
    if (!docs) continue;
    const path = route.replace(/:(\w+)/g, "{$1}");
    (paths[path] ??= {})[method.toLowerCase()] = operationFor(docs, schemas);
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "DubbingBase API",
      version: "1.0.0",
      description:
        "Admins create a token under Profile → API Key and send it as `Authorization: Bearer dbk_live_…`. " +
        "Every response is `no-store`; errors are `{ error: { code, message } }`. " +
        "Media lives at `/api/v1/{movies|shows|games|podcasts|audiobooks|advertisements|toys}/{id}` " +
        "(TMDB, IGDB, iTunes and Open Library ids; ads and toys use their DubbingBase id); " +
        "follow the `path` fields in responses instead of building URLs. " +
        "Credit writes behave as if the token's owner made them, and `?dry_run=true` previews a batch without writing.",
    },
    paths,
    components: {
      schemas,
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: `Personal API token. Scopes: ${API_SCOPES.join(", ")}.`,
        },
      },
    },
  };
}
