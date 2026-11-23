import { toJsonSchema } from "@valibot/to-json-schema";
import {
  defineEventHandler,
  getHeader,
  getQuery,
  getRouterParams,
  isError,
  readBody,
  setHeader,
  setResponseStatus,
  type H3Event,
} from "h3";
import { isRecord } from "@app/shared-logic";
import * as v from "valibot";
import type { ApiScope } from "../../../shared/api-scopes";
import { isUuid } from "../game-character-validation";
import { ApiError } from "./errors";
import {
  authenticateApiToken,
  clientAddress,
  consumeIpRateLimit,
  consumeRateLimit,
  readBearerToken,
  type ApiPrincipal,
} from "./tokens";

type ObjectSchema = v.ObjectSchema<v.ObjectEntries, undefined>;
type NoBody = v.UndefinedSchema<undefined>;

/**
 * One public API route, declared once. The same valibot schemas validate the request at
 * runtime, type the handler, validate the response, and generate the OpenAPI document
 * (see `buildOpenApiSpec`). Every route requires a bearer token holding `scope`.
 */
export interface ApiRouteDefinition<
  TParams extends ObjectSchema,
  TQuery extends ObjectSchema,
  TResponse extends v.GenericSchema,
  TBody extends v.GenericSchema,
> {
  summary: string;
  tags: readonly string[];
  scope: ApiScope;
  params: TParams;
  query: TQuery;
  /** JSON request body schema; omit for routes without one. */
  body?: TBody;
  /** Accepts an optional UUID `Idempotency-Key` header; one is generated when it is absent. */
  idempotent?: boolean;
  response: TResponse;
  handler: (input: {
    event: H3Event;
    auth: ApiPrincipal;
    params: v.InferOutput<TParams>;
    query: v.InferOutput<TQuery>;
    body: v.InferOutput<TBody>;
    /** The `Idempotency-Key` header (or a generated one) on `idempotent` routes, otherwise null. */
    idempotencyKey: string | null;
  }) => v.InferInput<TResponse> | Promise<v.InferInput<TResponse>>;
}

/** What the spec builder needs from a definition, without the handler's generics. */
export interface ApiRouteDocs {
  summary: string;
  tags: readonly string[];
  scope: ApiScope;
  params: ObjectSchema;
  query: ObjectSchema;
  body?: v.GenericSchema;
  idempotent?: boolean;
  response: v.GenericSchema;
}

function respondWithError(event: H3Event, error: ApiError) {
  setResponseStatus(event, error.status);
  for (const [name, value] of Object.entries(error.headers)) setHeader(event, name, value);
  return { error: { code: error.code, message: error.message } };
}

function issueMessages(issues: readonly v.BaseIssue<unknown>[]): string {
  return issues
    .map((issue) => {
      const path = issue.path?.map((part) => String(part.key)).join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

async function authorize(event: H3Event, scope: ApiScope): Promise<ApiPrincipal> {
  const ipLimit = consumeIpRateLimit(clientAddress(event));
  if (!ipLimit.allowed) {
    throw new ApiError(429, "rate_limited", "Too many requests.", {
      "Retry-After": String(ipLimit.retryAfter),
    });
  }
  const token = readBearerToken(event);
  const principal = token ? await authenticateApiToken(event, token) : null;
  if (!principal) {
    throw new ApiError(401, "unauthorized", "Missing, invalid, expired or revoked API token.", {
      "WWW-Authenticate": 'Bearer realm="DubbingBase API"',
    });
  }
  const limit = consumeRateLimit(principal.tokenId);
  setHeader(event, "RateLimit-Limit", String(limit.limit));
  setHeader(event, "RateLimit-Remaining", String(limit.remaining));
  if (!limit.allowed) {
    throw new ApiError(429, "rate_limited", "Too many requests.", {
      "Retry-After": String(limit.retryAfter),
    });
  }
  if (!principal.scopes.includes(scope)) {
    throw new ApiError(403, "insufficient_scope", `This token lacks the "${scope}" scope.`);
  }
  return principal;
}

export function defineApiRoute<
  TParams extends ObjectSchema,
  TQuery extends ObjectSchema,
  TResponse extends v.GenericSchema,
  TBody extends v.GenericSchema = NoBody,
>(definition: ApiRouteDefinition<TParams, TQuery, TResponse, TBody>) {
  const handler = defineEventHandler(async (event) => {
    setHeader(event, "Cache-Control", "no-store");
    setHeader(event, "X-Request-Id", crypto.randomUUID());
    try {
      const auth = await authorize(event, definition.scope);
      const params = v.safeParse(definition.params, getRouterParams(event, { decode: true }));
      const query = v.safeParse(definition.query, getQuery(event));
      const rawBody: unknown = definition.body ? await readBody(event) : undefined;
      const body = v.safeParse(definition.body ?? v.undefined(), rawBody);
      if (!params.success || !query.success || !body.success) {
        throw new ApiError(
          400,
          "invalid_request",
          issueMessages([
            ...(params.issues ?? []),
            ...(query.issues ?? []),
            ...(body.issues ?? []),
          ]),
        );
      }
      let idempotencyKey: string | null = null;
      if (definition.idempotent) {
        const header = getHeader(event, "idempotency-key");
        if (header !== undefined && !isUuid(header)) {
          throw new ApiError(400, "invalid_request", "Idempotency-Key must be a UUID.");
        }
        idempotencyKey = header ?? crypto.randomUUID();
      }
      const result = await definition.handler({
        event,
        auth,
        params: params.output,
        query: query.output,
        body: body.output,
        idempotencyKey,
      });
      return v.parse(definition.response, result);
    } catch (error) {
      if (error instanceof ApiError) return respondWithError(event, error);
      if (isError(error) && error.statusCode < 500) {
        return respondWithError(event, new ApiError(error.statusCode, "error", error.message));
      }
      console.error("Unhandled API v1 error", error instanceof Error ? error.name : "unknown");
      return respondWithError(event, new ApiError(500, "internal_error", "Internal server error."));
    }
  });
  return { handler, docs: definition satisfies ApiRouteDocs };
}

/** Named JSON Schemas shared by every operation; becomes `components.schemas`. */
export type SchemaComponents = Record<string, unknown>;

function rewriteRefs(node: unknown, rename: (name: string) => string): unknown {
  if (Array.isArray(node)) return node.map((item) => rewriteRefs(item, rename));
  if (!isRecord(node)) return node;
  return Object.fromEntries(
    Object.entries(node).map(([key, value]) => [
      key,
      key === "$ref" && typeof value === "string" && value.startsWith("#/$defs/")
        ? `#/components/schemas/${rename(value.slice("#/$defs/".length))}`
        : rewriteRefs(value, rename),
    ]),
  );
}

/**
 * Converts a valibot schema to JSON Schema. Recursive schemas come back with local `#/$defs/…`
 * references, which would dangle once the schema is embedded in an operation, so their
 * definitions are hoisted into `components` under unique names and the references rewritten.
 */
function jsonSchema(schema: v.GenericSchema, components: SchemaComponents) {
  const { $schema: _ignored, $defs, ...rest } = toJsonSchema(schema, { errorMode: "ignore" });
  if (!$defs) return rest;
  const prefix = `Schema${Object.keys(components).length}`;
  const rename = (name: string) => `${prefix}_${name}`;
  for (const [name, definition] of Object.entries($defs)) {
    components[rename(name)] = rewriteRefs(definition, rename);
  }
  return rewriteRefs(rest, rename);
}

function parametersOf(
  schema: ObjectSchema,
  location: "path" | "query",
  components: SchemaComponents,
) {
  return Object.entries(schema.entries).map(([name, entry]) => ({
    name,
    in: location,
    required: location === "path" || entry.type !== "optional",
    schema: jsonSchema(entry, components),
  }));
}

const errorResponse = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: { code: { type: "string" }, message: { type: "string" } },
            required: ["code", "message"],
          },
        },
        required: ["error"],
      },
    },
  },
});

export function operationFor(docs: ApiRouteDocs, components: SchemaComponents) {
  const idempotencyHeader = docs.idempotent
    ? [
        {
          name: "Idempotency-Key",
          in: "header",
          required: false,
          description:
            "A UUID you generate. Retrying a request with the same key never applies it twice.",
          schema: { type: "string", format: "uuid" },
        },
      ]
    : [];
  return {
    summary: docs.summary,
    tags: [...docs.tags],
    security: [{ bearerAuth: [docs.scope] }],
    parameters: [
      ...parametersOf(docs.params, "path", components),
      ...parametersOf(docs.query, "query", components),
      ...idempotencyHeader,
    ],
    ...(docs.body
      ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: jsonSchema(docs.body, components) } },
          },
        }
      : {}),
    responses: {
      200: {
        description: "OK",
        content: { "application/json": { schema: jsonSchema(docs.response, components) } },
      },
      400: errorResponse("Invalid request"),
      401: errorResponse("Missing, invalid, expired or revoked token"),
      403: errorResponse("The token lacks the required scope"),
      429: errorResponse("Rate limited; see Retry-After"),
    },
  };
}
