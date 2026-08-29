import { API_CLIENT_HEADER, API_CLIENT_VALUE } from "../../shared/constants";

const ALLOWED_ORIGINS = [
  "https://dubbingbase.com",
  "https://www.dubbingbase.com",
];

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.some(
    (a) => origin === a || origin.startsWith(a + "/"),
  );
}

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname;
  if (!path.startsWith("/api")) return;

  // Prime the KV cache resolver for this worker isolate
  useCache(event);

  const origin = getHeader(event, "origin") || "";
  const client = getHeader(event, API_CLIENT_HEADER) || "";

  setResponseHeader(
    event,
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  setResponseHeader(
    event,
    "Access-Control-Allow-Headers",
    `Content-Type, Authorization, ${API_CLIENT_HEADER}`,
  );
  setResponseHeader(event, "Access-Control-Max-Age", "86400");
  setResponseHeader(event, "Vary", "Origin");

  if (isAllowedOrigin(origin)) {
    setResponseHeader(event, "Access-Control-Allow-Origin", origin);
    setResponseHeader(event, "Access-Control-Allow-Credentials", "true");
  }

  if (getMethod(event) === "OPTIONS") {
    setResponseStatus(event, 204);
    return;
  }

  if (origin && !isAllowedOrigin(origin)) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }

  if (origin && client !== API_CLIENT_VALUE) {
    throw createError({ statusCode: 403, message: "Forbidden" });
  }
});
