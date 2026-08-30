import { API_CLIENT_HEADER, API_CLIENT_VALUE } from "@app/shared-logic";

const ALLOWED_ORIGINS = [
  "https://dubbingbase.com",
  "https://www.dubbingbase.com",
];

function isAllowedOrigin(origin: string, host?: string): boolean {
  if (!origin) return true;
  if (host && (origin === `http://${host}` || origin === `https://${host}`)) {
    return true;
  }
  return (
    ALLOWED_ORIGINS.some((a) => origin === a || origin.startsWith(a + "/")) ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    origin.endsWith(".pages.dev") ||
    origin.endsWith(".workers.dev") ||
    origin.startsWith("http://100.") || // Tailscale
    origin.startsWith("https://100.") ||
    origin.startsWith("http://192.168.") || // LAN
    origin.startsWith("http://10.")
  );
}

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname;
  if (!path.startsWith("/api")) return;

  // Prime the KV cache resolver for this worker isolate
  useCache(event);

  const origin = getHeader(event, "origin") || "";
  const host = getHeader(event, "host") || "";
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

  if (isAllowedOrigin(origin, host)) {
    setResponseHeader(event, "Access-Control-Allow-Origin", origin || "*");
    setResponseHeader(event, "Access-Control-Allow-Credentials", "true");
  }

  if (getMethod(event) === "OPTIONS") {
    setResponseStatus(event, 204);
    return;
  }

  if (origin && !isAllowedOrigin(origin, host)) {
    throw createError({
      statusCode: 403,
      message: "Forbidden (Invalid Origin)",
    });
  }

  const isSameOrigin =
    !origin ||
    (host && (origin === `http://${host}` || origin === `https://${host}`));

  // If request has an origin from another domain and is missing the client header, reject
  if (
    origin &&
    !isSameOrigin &&
    !isAllowedOrigin(origin, host) &&
    client !== API_CLIENT_VALUE
  ) {
    throw createError({
      statusCode: 403,
      message: "Forbidden (Missing Client Header)",
    });
  }
});
