import type { Toy } from "@app/shared-logic";
import type { Database } from "@app/supabase/types";
import { useSupabaseAdmin } from "../db/client";

type ToyMetadataRow = Pick<
  Database["public"]["Tables"]["toy_metadata"]["Row"],
  | "content_id"
  | "name"
  | "manufacturer"
  | "product_line"
  | "release_year"
  | "cover_url"
  | "description"
  | "updated_at"
>;

function mapToy(row: ToyMetadataRow): Toy {
  return {
    id: row.content_id,
    name: row.name,
    manufacturer: row.manufacturer,
    ...(row.product_line === null ? {} : { product_line: row.product_line }),
    ...(row.release_year === null ? {} : { release_year: row.release_year }),
    cover_url: row.cover_url,
    description: row.description,
    updated_at: row.updated_at,
    media_type: "toy",
  };
}

export class ToyClient {
  async searchToys(query: string, limit = 15): Promise<Toy[]> {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) return [];

    try {
      const supabase = useSupabaseAdmin();
      const { data, error } = await supabase
        .from("toy_metadata")
        .select(
          "content_id, name, manufacturer, product_line, release_year, cover_url, description, updated_at",
        )
        .ilike("name", `%${trimmedQuery}%`)
        .limit(limit);

      if (error) throw error;
      return (data || []).map(mapToy);
    } catch (err) {
      console.error("Toy search failed:", err);
      return [];
    }
  }

  async getToy(id: number): Promise<Toy | null> {
    const supabase = useSupabaseAdmin();
    const { data, error } = await supabase
      .from("toy_metadata")
      .select(
        "content_id, name, manufacturer, product_line, release_year, cover_url, description, updated_at",
      )
      .eq("content_id", id)
      .maybeSingle();

    if (error) throw error;
    return data ? mapToy(data) : null;
  }
}
