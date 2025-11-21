import { supabase } from './database.ts';

export class VoiceActorService {
  async upsertVoiceActor(firstName: string, lastName: string) {
    // Check if voice actor already exists
    const { data: existing } = await supabase.from('voice_actors')
      .select('id')
      .eq('firstname', firstName)
      .eq('lastname', lastName)
      .single();

    const inserted = !existing;

    const { data, error } = await supabase.from('voice_actors')
      .upsert({ firstname: firstName, lastname: lastName }, {
        onConflict: 'firstname,lastname'
      })
      .select();

    if (error) throw error;
    return { data: data[0], inserted };
  }

  async upsertWork(voiceActorId: number, contentId: number, actorId: number, contentType: string, performance?: string) {
    const { data, error } = await supabase.from('work')
      .upsert({
        voice_actor_id: voiceActorId,
        content_id: contentId,
        actor_id: actorId,
        content_type: contentType,
        performance
      }, {
        onConflict: 'voice_actor_id,content_id,actor_id,content_type'
      })
      .select();

    if (error) throw error;
    return data;
  }

  async insertVoiceActorAndWork(firstName: string, lastName: string, contentId: number, actorId: number, contentType: string, performance?: string) {
    const voiceActorResult = await this.upsertVoiceActor(firstName, lastName);
    const workResult = await this.upsertWork(voiceActorResult.data.id, contentId, actorId, contentType, performance);
    return { voiceActorResult, workResult };
  }
}
