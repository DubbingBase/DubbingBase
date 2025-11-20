import { supabase } from './database.ts';

export class VoiceActorService {
  async upsertVoiceActor(firstName: string, lastName: string) {
    const { data, error } = await supabase.from('voice_actors')
      .upsert({ firstname: firstName, lastname: lastName }, {
        onConflict: 'firstname,lastname'
      })
      .select();

    if (error) throw error;
    return data[0];
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
    const voiceActor = await this.upsertVoiceActor(firstName, lastName);
    return this.upsertWork(voiceActor.id, contentId, actorId, contentType, performance);
  }
}
