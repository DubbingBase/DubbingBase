import type { Tables, Toy } from "@app/shared-logic";
import { useSupabaseAdmin } from "../db/client";

type ToyMetadataRow = Pick<
  Tables<"toy_metadata">,
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

    const escapedLikeQuery = trimmedQuery
      .replaceAll("\\", "\\\\")
      .replaceAll("%", "\\%")
      .replaceAll("_", "\\_");
    const ilikePattern = `"%${escapedLikeQuery.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}%"`;

    try {
      const supabase = useSupabaseAdmin();
      const { data, error } = await supabase
        .from("toy_metadata")
        .select(
          "content_id, name, manufacturer, product_line, release_year, cover_url, description, updated_at",
        )
        .or(
          `name.ilike.${ilikePattern},manufacturer.ilike.${ilikePattern},product_line.ilike.${ilikePattern}`,
        )
        .limit(limit);

      if (error) throw error;
      return (data || []).map(mapToy);
    } catch (err) {
      console.error("Toy search failed:", err);
      throw err;
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
