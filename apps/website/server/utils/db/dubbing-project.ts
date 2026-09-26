import { useSupabaseAdmin } from "./client";
import { requireDubbingLanguage } from "../dubbing-language";

export async function findOrCreateDubbingProject(
  contentId: number,
  contentType: string,
  language: string,
): Promise<number> {
  requireDubbingLanguage(language);
  const supabase = useSupabaseAdmin();

  const { data: existing, error: lookupError } = await supabase
    .from("dubbing_projects")
    .select("id")
    .eq("content_id", contentId)
    .eq("content_type", contentType)
    .eq("language", language)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (existing) {
    return existing.id;
  }

  const { data: newProject, error } = await supabase
    .from("dubbing_projects")
    .insert({
      content_id: contentId,
      content_type: contentType,
      language,
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    const { data: concurrent, error: concurrentError } = await supabase
      .from("dubbing_projects")
      .select("id")
      .eq("content_id", contentId)
      .eq("content_type", contentType)
      .eq("language", language)
      .single();
    if (concurrentError) throw concurrentError;
    return concurrent.id;
  }
  if (error) throw error;
  return newProject.id;
}
