import { useSupabaseAdmin } from "./client";
import { requireDubbingLanguage } from "../dubbing-language";

export async function findOrCreateDubbingProject(
  contentId: number,
  contentType: string,
  dubbingLanguage: string,
  actorId: string,
  voiceActorId: number | null,
  requestId: string,
): Promise<number> {
  const language = requireDubbingLanguage(dubbingLanguage);
  const supabase = useSupabaseAdmin();
  const { data, error } = await supabase.rpc("find_or_create_dubbing_project", {
    p_actor_id: actorId,
    p_voice_actor_id: voiceActorId,
    p_request_id: requestId,
    p_content_id: contentId,
    p_content_type: contentType,
    p_language: language,
  });

  if (error) throw error;
  const project = data?.[0];
  if (!project) throw new Error("Unable to resolve dubbing project");
  return project.project_id;
}
