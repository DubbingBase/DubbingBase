import { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { Database } from "./database.types.ts";
import { findOrCreateDubbingProject } from "./dubbing-project.ts";

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
  private supabase: SupabaseClient<Database>;

  constructor(supabaseClient: SupabaseClient<Database>) {
    this.supabase = supabaseClient;
  }

  async upsertVoiceActor(
    firstName: string,
    lastName: string,
    tmdbId?: number | null,
  ) {
    // Check if voice actor already exists using the robust RPC
    const { data: existingRecords, error: rpcError } = await this.supabase.rpc(
      "match_voice_actor",
      {
        p_firstname: firstName,
        p_lastname: lastName,
      },
    );

    if (rpcError) {
      console.error("RPC match_voice_actor failed:", rpcError);
    }

    const existing =
      existingRecords && existingRecords.length > 0 ? existingRecords[0] : null;
    const inserted = !existing;

    // Use the existing exact spelling if found, to preserve original proper casing/accents
    const finalFirstName = existing ? existing.firstname : firstName;
    const finalLastName = existing ? existing.lastname : lastName;

    const upsertData: Database["public"]["Tables"]["voice_actors"]["Insert"] = {
      firstname: finalFirstName,
      lastname: finalLastName,
    };

    if (existing) {
      upsertData.id = existing.id;
    }

    if (tmdbId) {
      upsertData.tmdb_id = tmdbId;
    } else if (existing && !existing.tmdb_id) {
      // Existing record has no tmdb_id — try to resolve it
      const resolvedId = await searchTmdbPerson(
        `${finalFirstName} ${finalLastName}`,
      );
      if (resolvedId) {
        upsertData.tmdb_id = resolvedId;
      }
    } else if (!existing) {
      // New record — try to resolve tmdb_id
      const resolvedId = await searchTmdbPerson(
        `${finalFirstName} ${finalLastName}`,
      );
      if (resolvedId) {
        upsertData.tmdb_id = resolvedId;
      }
    }

    // If we matched an existing record, we upsert on its id to avoid unique constraint violations
    // on firstname,lastname. If it's a completely new record, we use firstname,lastname.
    const onConflictColumn = existing ? "id" : "firstname,lastname";

    const { data, error } = await this.supabase
      .from("voice_actors")
      .upsert(upsertData, {
        onConflict: onConflictColumn,
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
    const dubbing_project_id = await findOrCreateDubbingProject(
      this.supabase,
      contentId,
      contentType,
    );



    const { data, error } = await this.supabase
      .from("work")
      .upsert({
        voice_actor_id: voiceActorId,
        actor_id: actorId,
        performance,
        dubbing_project_id,
      })
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
