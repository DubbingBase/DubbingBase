import type { EditorTmdbCastMember } from "./admin-project-editor-types";

/** The two TMDB-backed media kinds that share one project editor. */
export type TmdbEditorKind = "movie" | "show";

interface TmdbMovieResponse {
  movie?: {
    title: string;
    poster_path?: string | null;
    credits?: { cast?: EditorTmdbCastMember[] };
  } | null;
}

interface TmdbShowResponse {
  serie?: { name: string; poster_path?: string | null };
  aggregateCredits?: { cast?: EditorTmdbCastMember[] };
}

export interface TmdbMediaSummary {
  title: string;
  posterPath: string | null;
  cast: EditorTmdbCastMember[];
}

/** Per-kind differences; everything else in the editor is shared. */
export const TMDB_EDITOR_KINDS = {
  movie: {
    routeParam: "movieId",
    basePath: "/movie",
    /** `dubbing_projects.content_type` */
    contentType: "movie",
    /** Media type understood by the character image resolver. */
    characterMediaType: "movie",
    formId: "movie-project-form",
    idInputId: "movie-project-tmdb-id",
    titleInputId: "movie-project-title",
    idPrefix: "movie-project",
    i18n: {
      create: "projectEditor.createMovieProject",
      edit: "projectEditor.editMovieProject",
      back: "projectEditor.backToMovie",
      save: "projectEditor.saveMovieProject",
      tmdbId: "projectEditor.tmdbMovieId",
    },
  },
  show: {
    routeParam: "showId",
    basePath: "/show",
    contentType: "tv",
    characterMediaType: "tv",
    formId: "show-project-form",
    idInputId: "show-project-tmdb-id",
    titleInputId: "show-project-title",
    idPrefix: "show-project",
    i18n: {
      create: "projectEditor.createShowProject",
      edit: "projectEditor.editShowProject",
      back: "projectEditor.backToShow",
      save: "projectEditor.saveShowProject",
      tmdbId: "projectEditor.tmdbShowId",
    },
  },
} as const satisfies Record<TmdbEditorKind, object>;

/** Dynamic-id GET route that serves the TMDB metadata of a work. */
export const tmdbEditorApiPath = (kind: TmdbEditorKind, id: number): string => `/api/${kind}/${id}`;

/** Series credits aggregate several roles per actor; movies carry a single `character`. */
export const extractCastRoles = (member: EditorTmdbCastMember): string => {
  if (member.roles && member.roles.length > 0) {
    return member.roles
      .map((role) => role.character)
      .filter(Boolean)
      .join(", ");
  }
  return member.character || "";
};

export const parseTmdbMovie = (payload: TmdbMovieResponse | null): TmdbMediaSummary | null =>
  payload?.movie
    ? {
        title: payload.movie.title,
        posterPath: payload.movie.poster_path ?? null,
        cast: payload.movie.credits?.cast ?? [],
      }
    : null;

export const parseTmdbShow = (payload: TmdbShowResponse | null): TmdbMediaSummary | null =>
  payload?.serie
    ? {
        title: payload.serie.name,
        posterPath: payload.serie.poster_path ?? null,
        cast: payload.aggregateCredits?.cast ?? [],
      }
    : null;

export const fetchTmdbMediaSummary = async (
  kind: TmdbEditorKind,
  id: number,
): Promise<TmdbMediaSummary | null> => {
  const path = tmdbEditorApiPath(kind, id);
  return kind === "movie"
    ? parseTmdbMovie(await $fetch<TmdbMovieResponse | null>(path))
    : parseTmdbShow(await $fetch<TmdbShowResponse | null>(path));
};
