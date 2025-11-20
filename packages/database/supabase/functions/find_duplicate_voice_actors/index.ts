import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase, supabaseAdmin } from "../_shared/database.ts"

interface VoiceActor {
  id: string;
  firstname: string | null;
  lastname: string | null;
}

// Utility to remove accents and lowercase
function normalizeName(str: string | null): string {
  return (str || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Process a batch of actors and update the groups
function processActorsBatch(
  actors: VoiceActor[],
  existingGroups: Record<string, VoiceActor[]> = {}
): Record<string, VoiceActor[]> {
  const groups = { ...existingGroups };

  for (const actor of actors) {
    const key = `${normalizeName(actor.firstname)}|${normalizeName(actor.lastname)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(actor);
  }

  return groups;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const BATCH_SIZE = 1000;
    let cursor = 0;
    let hasMore = true;
    let groups: Record<string, VoiceActor[]> = {};

    // Process all records in batches
    while (hasMore) {
      const { data: batch, error } = await supabaseAdmin
        .from('voice_actors')
        .select('id, firstname, lastname')
        .order('id', { ascending: true })
        .range(cursor, cursor + BATCH_SIZE - 1);

      if (error) throw error;

      if (!batch || batch.length === 0) {
        hasMore = false;
      } else {
        // Cast the batch to VoiceActor[] to handle Supabase's return type
        groups = processActorsBatch(batch as unknown as VoiceActor[], groups);
        cursor += batch.length;

        // If we got fewer records than requested, we've reached the end
        if (batch.length < BATCH_SIZE) {
          hasMore = false;
        }
      }

      // Allow event loop to process other tasks between batches
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // Convert groups to array of duplicates and filter out non-duplicates
    const duplicates = Object.values(groups)
      .filter(group => group.length > 1)
      .map(actors => ({
        actors: actors.map(actor => ({
          id: actor.id,
          firstname: actor.firstname,
          lastname: actor.lastname
        }))
      }));

    return new Response(JSON.stringify(duplicates), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error finding duplicate voice actors:', errorMessage);

    return new Response(
      JSON.stringify({
        error: 'Failed to process request',
        details: errorMessage
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
