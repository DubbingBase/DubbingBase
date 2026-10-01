import { requireAdmin } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";
import { z } from "zod";

const nullableText = z.preprocess(
  (value: unknown) => (value === "" ? null : value),
  z.string().nullable().optional(),
);
const nullableDate = z.preprocess(
  (value: unknown) => (value === "" ? null : value),
  z.string().date().nullable().optional(),
);
const nullableInteger = z.preprocess(
  (value: unknown) => (value === "" ? null : value),
  z.coerce.number().int().nullable().optional(),
);

const updatesSchema = z
  .object({
    firstname: z.string().trim().min(1).optional(),
    lastname: z.string().trim().min(1).optional(),
    bio: nullableText,
    nationality: nullableText,
    date_of_birth: nullableDate,
    tmdb_id: nullableInteger,
    wikidata_id: nullableText,
  })
  .strict();

const bodySchema = z
  .object({
    keepId: z.coerce.number().int().positive(),
    ids: z.array(z.coerce.number().int().positive()).min(1),
    updates: updatesSchema.default({}),
  })
  .strict();

export default defineEventHandler(async (event) => {
  requireAdmin(event);

  const parsedBody = bodySchema.safeParse(await readBody(event));
  if (!parsedBody.success) {
    throw createError({ statusCode: 400, message: "Invalid merge input" });
  }

  const { keepId: normalizedKeepId, ids, updates } = parsedBody.data;
  const otherIds = [...new Set(ids)].filter(
    (id: number) => id !== normalizedKeepId,
  );
  if (otherIds.length === 0) {
    throw createError({
      statusCode: 400,
      message: "No duplicate IDs to merge",
    });
  }

  const supabaseAdmin = useSupabaseAdmin(event);

  const { data, error: rpcError } = await supabaseAdmin.rpc(
    "merge_voice_actor_duplicates_atomic",
    {
      p_keep_id: normalizedKeepId,
      p_other_ids: otherIds,
      p_updates: updates,
    },
  );

  if (rpcError) {
    throw createError({ statusCode: 500, message: rpcError.message });
  }

  return { success: true, result: data };
});
