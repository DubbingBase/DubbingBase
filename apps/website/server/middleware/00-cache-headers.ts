import { defineEventHandler } from "h3";
import { setNoCacheHeaders } from "../utils/cache/http";

export default defineEventHandler((event) => {
  setNoCacheHeaders(event);
});
