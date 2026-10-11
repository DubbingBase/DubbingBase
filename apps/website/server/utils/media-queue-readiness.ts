export const mediaQueueNames = ["wiki_scan", "wiki_extract"] as const;

export type MediaQueueName = (typeof mediaQueueNames)[number];

export function getReadyMediaQueueNames(value: unknown): MediaQueueName[] {
  if (!Array.isArray(value)) return [];
  const readyNames = new Set(
    value.filter((name): name is MediaQueueName =>
      mediaQueueNames.some((allowedName) => allowedName === name),
    ),
  );
  return mediaQueueNames.filter((name) => readyNames.has(name));
}
