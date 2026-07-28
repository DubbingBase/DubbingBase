export type {
  Tables,
  Database,
  TablesInsert,
  TablesUpdate,
  Enums,
} from "@supabase/functions/_shared/database.types";

export type { TrendingResponse as MovieTrendingResponse } from "@supabase/functions/_shared/movie";
export type { TrendingResponse as SerieTrendingResponse } from "@supabase/functions/_shared/serie";
export type { Serie as SerieModel } from "@supabase/functions/_shared/serie";
export type { Movie as MovieModel } from "@supabase/functions/_shared/movie";
export type { Actor } from "@supabase/functions/_shared/types";

export interface Role {
  character: string;
  image?: string;
}

export interface PersonData<T = unknown | undefined> {
  id: number;
  name?: string;
  firstname?: string;
  lastname?: string;
  roles?: Role[];
  profile_picture?: string | null;
  profile_path?: string;
  performance?: string;
  tags?: string[] | string;
  tmdb_id?: number;
  data?: T;
  character?: string;
  reviewed_status?: string | null;
  work_id?: number;
  status?: string | null;
}
