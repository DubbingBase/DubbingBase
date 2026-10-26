import type { Advertisement } from "@app/shared-logic";
import { useSupabaseAdmin } from "../db/client";

export class AdvertisementClient {
  async searchAdvertisements(
    query: string,
    limit = 15,
  ): Promise<Advertisement[]> {
    if (!query || query.trim().length < 2) return [];

    try {
      const supabase = useSupabaseAdmin();
      // Search in dubbing projects or custom ads stored in the database
      const { data } = await supabase
        .from("dubbing_projects")
        .select("content_id, created_at, studios(name)")
        .eq("content_type", "advertisement")
        .limit(limit);

      if (!data) return [];

      return data.map((item: any) => ({
        id: item.content_id,
        title: `Spot Publicitaire #${item.content_id}`,
        brand: item.studios?.name || "Marque inconnue",
        media_type: "advertisement" as const,
      }));
    } catch (err) {
      console.error("Advertisement search failed:", err);
      return [];
    }
  }

  async getAdvertisement(id: number): Promise<Advertisement | null> {
    try {
      const supabase = useSupabaseAdmin();
      const { data: project } = await supabase
        .from("dubbing_projects")
        .select("*, studios(id, name)")
        .eq("content_id", id)
        .eq("content_type", "advertisement")
        .maybeSingle();

      return {
        id,
        title: `Spot Publicitaire #${id}`,
        brand: project?.studios?.name || "Campagne publicitaire",
        media_type: "advertisement" as const,
        year: project?.created_at
          ? new Date(project.created_at).getFullYear()
          : undefined,
      };
    } catch (err) {
      console.error(`Failed to fetch advertisement #${id}:`, err);
      return {
        id,
        title: `Spot Publicitaire #${id}`,
        brand: "Marque",
        media_type: "advertisement" as const,
      };
    }
  }
}
