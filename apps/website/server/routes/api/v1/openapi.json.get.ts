import { buildOpenApiSpec } from "../../../utils/api-v1/spec";

export default defineEventHandler((event) => {
  setHeader(event, "Link", '</api/v1/docs>; rel="service-doc"; type="text/html"');
  return buildOpenApiSpec();
});
