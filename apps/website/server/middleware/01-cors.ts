import { API_CLIENT_HEADER } from "@app/shared-logic";

const ALLOWED_ORIGINS = new Set([
  "https://dubbingbase.com",
  "https://www.dubbingbase.com",
]);

function isAllowedOrigin(origin: string, host: string): boolean {
  if (host && (origin === `http://${host}` || origin === `https://${host}`)) {
    return true;
  }
  return ALLOWED_ORIGINS.has(origin);
}

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname;
  if (!path.startsWith("/api")) return;

  // API responses default to private; public handlers opt in with short cache headers.
  const origin = getHeader(event, "origin") || "";
  const host = getHeader(event, "host") || "";

  if (origin && !isAllowedOrigin(origin, host)) {
    throw createError({
      statusCode: 403,
      message: "Forbidden (Invalid Origin)",
    });
  }

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

  if (origin) {
    setResponseHeader(event, "Access-Control-Allow-Origin", origin);
    setResponseHeader(event, "Access-Control-Allow-Credentials", "true");
  }

  if (getMethod(event) === "OPTIONS") {
    setResponseStatus(event, 204);
    return;
  }
});
