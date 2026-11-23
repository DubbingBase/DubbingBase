import manifest from "#api-v1-manifest";
import { API_SCOPES } from "../../../shared/api-scopes";
import { operationFor, type ApiRouteDocs } from "./define";

export function buildOpenApiSpec() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const { route, method, module } of manifest) {
    const docs: ApiRouteDocs | undefined = module.route?.docs;
    if (!docs) continue;
    const path = route.replace(/:(\w+)/g, "{$1}");
    (paths[path] ??= {})[method.toLowerCase()] = operationFor(docs);
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "DubbingBase API",
      version: "1.0.0",
      description:
        "Admins create a token under Profile → API Key and send it as `Authorization: Bearer dbk_live_…`. " +
        "Every response is `no-store`; errors are `{ error: { code, message } }`.",
    },
    paths,
    components: {
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
