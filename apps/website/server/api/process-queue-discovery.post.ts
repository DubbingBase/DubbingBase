import processMediaQueue from "./process-media-queue.post";

export default defineEventHandler(async (event) => {
  // Override or inject query.queue = "discovery"
  const url = new URL(event.node.req.url || "", "http://localhost");
  url.searchParams.set("queue", "discovery");
  (event.node.req as any).url = url.pathname + url.search;

  return processMediaQueue(event);
});
