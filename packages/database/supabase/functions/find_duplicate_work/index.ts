import { corsHeaders } from "../_shared/http-utils.ts"
import { supabase, supabaseAdmin } from "../_shared/database.ts"

interface Work {
  id: number;
  content_id: number;
  actor_id: number;
  voice_actor_id: number | null;
  status?: string;
  performance?: string;
  content_type?: string;
}

// Utility to create a key for duplicate detection
function duplicateKey(row: Work): string {
  return `${row.content_id}|${row.actor_id}|${row.voice_actor_id ?? 'null'}`;
}

// Process a batch of works and update the groups
function processWorksBatch(
  works: Work[],
  existingGroups: Record<string, Work[]> = {}
): Record<string, Work[]> {
  const groups = { ...existingGroups };

  for (const work of works) {
    const key = duplicateKey(work);
    if (!groups[key]) groups[key] = [];
    groups[key].push(work);
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
    let groups: Record<string, Work[]> = {};

    // Process all records in batches
    while (hasMore) {
      const { data: batch, error } = await supabaseAdmin
        .from('work')
        .select('id, content_id, actor_id, voice_actor_id, status, performance, content_type')
        .order('id', { ascending: true })
        .range(cursor, cursor + BATCH_SIZE - 1);

      if (error) throw error;

      if (!batch || batch.length === 0) {
        hasMore = false;
      } else {
        // Cast the batch to Work[] to handle Supabase's return type
        groups = processWorksBatch(batch as unknown as Work[], groups);
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
      .map(works => ({
        works: works.map(work => ({
          id: work.id,
          content_id: work.content_id,
          actor_id: work.actor_id,
          voice_actor_id: work.voice_actor_id,
          status: work.status,
          performance: work.performance,
          content_type: work.content_type
        }))
      }));

    return new Response(JSON.stringify(duplicates), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error finding duplicate works:', errorMessage);

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
