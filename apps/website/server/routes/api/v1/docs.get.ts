// Scalar renders the generated /api/v1/openapi.json. The version is pinned and the script is
// integrity-checked, because this page shares an origin with the signed-in site.
const SCALAR_VERSION = "1.77.0";
const SCALAR_INTEGRITY = "sha384-CbswbrhDJdJco8Bly6aK28bNRmItaYY60FH39FPNb/cjgKHsSk7M20ltBaqIZVyf";

export default defineEventHandler((event) => {
  setHeader(event, "Content-Type", "text/html; charset=utf-8");
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DubbingBase API</title>
  </head>
  <body>
    <script id="api-reference" data-url="/api/v1/openapi.json"></script>
    <script
      src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@${SCALAR_VERSION}"
      integrity="${SCALAR_INTEGRITY}"
      crossorigin="anonymous"
    ></script>
  </body>
</html>`;
});
