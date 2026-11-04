type MediaEditorRoutePrefix =
  | "movie"
  | "show"
  | "game"
  | "audiobook"
  | "podcast"
  | "advertisement"
  | "toy";

const MEDIA_EDITOR_ROUTE_PREFIXES: Record<string, MediaEditorRoutePrefix> = {
  movie: "movie",
  tv: "show",
  video_game: "game",
  audiobook: "audiobook",
  podcast: "podcast",
  advertisement: "advertisement",
  toy: "toy",
};

const MEDIA_TYPES_WITHOUT_DIRECT_CREATION = new Set<MediaEditorRoutePrefix>([
  "movie",
  "show",
  "game",
  "audiobook",
]);

type MediaEditorRouteInput = {
  contentType?: string | null;
  mediaId?: number | string | null;
  projectId?: number | string | null;
};

function isPresentId(value: number | string | null | undefined): value is number | string {
  return (
    value !== null && value !== undefined && String(value).trim() !== "" && String(value) !== "0"
  );
}

export function getMediaEditorRoute({
  contentType,
  mediaId,
  projectId,
}: MediaEditorRouteInput): string | null {
  if (!contentType) return null;

  const routePrefix = MEDIA_EDITOR_ROUTE_PREFIXES[contentType];
  if (!routePrefix) return null;
  if (mediaId !== null && mediaId !== undefined && !isPresentId(mediaId)) return null;
  if (projectId !== null && projectId !== undefined && !isPresentId(projectId)) return null;

  if (!isPresentId(mediaId)) {
    return MEDIA_TYPES_WITHOUT_DIRECT_CREATION.has(routePrefix)
      ? null
      : projectId === null || projectId === undefined
        ? `/${routePrefix}/new`
        : null;
  }
  if (!isPresentId(projectId)) return `/${routePrefix}/${mediaId}/projects/new`;
  return `/${routePrefix}/${mediaId}/projects/${projectId}/edit`;
}
