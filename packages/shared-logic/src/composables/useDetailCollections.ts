import type { PaginatedResponse } from "../types";

export type DetailCollection =
  | "media-cast"
  | "actor-filmography"
  | "actor-voice-actors"
  | "studio-projects"
  | "studio-voice-actors";

export type DetailCollectionParams = {
  collection: DetailCollection;
  id: string | number;
  type?: string;
  projectId?: string | number;
  seasonNumber?: string | number;
  episodeNumber?: string | number;
  query?: string;
  category?: string;
  sort?: string;
  view?: string;
  language?: string;
  lang?: string;
  page?: string | number;
  pageSize?: string | number;
};

export async function fetchDetailCollection<T>(
  params: DetailCollectionParams,
): Promise<PaginatedResponse<T>> {
  return await $fetch<PaginatedResponse<T>>("/api/detail-collections", {
    query: params,
  });
}
