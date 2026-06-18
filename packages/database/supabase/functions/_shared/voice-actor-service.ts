/**
 * Search TMDB for a person by name and return the best match's ID, or null.
 */
async function searchTmdbPerson(fullName: string): Promise<number | null> {
  const apiKey = Deno.env.get("TMDB_API_KEY");
  if (!apiKey) return null;

  try {
    const url = new URL("https://api.themoviedb.org/3/search/person");
    url.searchParams.set("query", fullName);
    url.searchParams.set("language", "fr-FR");

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      // Return the first (most relevant) match
      return data.results[0].id;
    }
    return null;
  } catch (error) {
    console.error(`Failed to search TMDB for person "${fullName}":`, error);
    return null;
  }
}

export class VoiceActorService {
  private supabase: any;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
  }

  async upsertVoiceActor(
    firstName: string,
    lastName: string,
    tmdbId?: number | null,
  ) {
    // Check if voice actor already exists
    const { data: existing } = await this.supabase
      .from("voice_actors")
      .select("id, tmdb_id")
      .eq("firstname", firstName)
      .eq("lastname", lastName)
      .single();

    const inserted = !existing;

    // If we have a tmdb_id to set, or the existing record is missing one, include it
    const upsertData: Record<string, any> = {
      firstname: firstName,
      lastname: lastName,
    };

    if (tmdbId) {
      upsertData.tmdb_id = tmdbId;
    } else if (existing && !existing.tmdb_id) {
      // Existing record has no tmdb_id — try to resolve it
      const resolvedId = await searchTmdbPerson(`${firstName} ${lastName}`);
      if (resolvedId) {
        upsertData.tmdb_id = resolvedId;
      }
    } else if (!existing) {
      // New record — try to resolve tmdb_id
      const resolvedId = await searchTmdbPerson(`${firstName} ${lastName}`);
      if (resolvedId) {
        upsertData.tmdb_id = resolvedId;
      }
    }

    const { data, error } = await this.supabase
      .from("voice_actors")
      .upsert(upsertData, {
        onConflict: "firstname,lastname",
      })
      .select();

    if (error) throw error;
    return { data: data[0], inserted };
  }

  async upsertWork(
    voiceActorId: number,
    contentId: number,
    actorId: number,
    contentType: string,
    performance?: string,
  ) {
    const { data, error } = await this.supabase
      .from("work")
      .upsert(
        {
          voice_actor_id: voiceActorId,
          content_id: contentId,
          actor_id: actorId,
          content_type: contentType,
          performance,
        },
        {
          onConflict: "voice_actor_id,content_id,actor_id,content_type",
        },
      )
      .select();

    if (error) throw error;
    return data;
  }

  async insertVoiceActorAndWork(
    firstName: string,
    lastName: string,
    contentId: number,
    actorId: number,
    contentType: string,
    performance?: string,
  ) {
    const voiceActorResult = await this.upsertVoiceActor(firstName, lastName);
    const workResult = await this.upsertWork(
      voiceActorResult.data.id,
      contentId,
      actorId,
      contentType,
      performance,
    );
    return { voiceActorResult, workResult };
  }
}
