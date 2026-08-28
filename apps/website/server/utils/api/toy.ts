import type { Toy } from "@app/shared-logic";
import { useSupabaseAdmin } from "../db/client";

export class ToyClient {
  async searchToys(query: string, limit = 15): Promise<Toy[]> {
    if (!query || query.trim().length < 2) return [];

    try {
      const supabase = useSupabaseAdmin();
      const { data } = await supabase
        .from("dubbing_projects")
        .select("content_id, created_at, studios(name)")
        .eq("content_type", "toy")
        .limit(limit);

      if (!data) return [];

      return data.map((item: any) => ({
        id: item.content_id,
        name: `Objet / Jouet Connecté #${item.content_id}`,
        manufacturer: item.studios?.name || "Fabricant",
        media_type: "toy" as const,
      }));
    } catch (err) {
      console.error("Toy search failed:", err);
      return [];
    }
  }

  async getToy(id: number): Promise<Toy | null> {
    try {
      const supabase = useSupabaseAdmin();
      const { data: project } = await supabase
        .from("dubbing_projects")
        .select("*, studios(id, name)")
        .eq("content_id", id)
        .eq("content_type", "toy")
        .maybeSingle();

      return {
        id,
        name: `Jouet Connecté / Histoire #${id}`,
        manufacturer: project?.studios?.name || "Lunii / VTech / Tonies",
        product_line: "Conteuse / Jouet interactif",
        media_type: "toy" as const,
        release_year: project?.created_at
          ? new Date(project.created_at).getFullYear()
          : undefined,
      };
    } catch (err) {
      console.error(`Failed to fetch toy #${id}:`, err);
      return {
        id,
        name: `Objet Connecté #${id}`,
        manufacturer: "Fabricant",
        media_type: "toy" as const,
      };
    }
  }
}
