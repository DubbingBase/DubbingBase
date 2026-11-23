// RFC 9727 API catalog: lets clients discover the public API from a well-known URL.
export default defineEventHandler((event) => {
  setHeader(
    event,
    "Content-Type",
    'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
  );
  setHeader(event, "Cache-Control", "public, max-age=3600");
  return {
    linkset: [
      {
        anchor: "/api/v1",
        "service-desc": [{ href: "/api/v1/openapi.json", type: "application/openapi+json" }],
        "service-doc": [{ href: "/api/v1/docs", type: "text/html" }],
      },
    ],
  };
});
