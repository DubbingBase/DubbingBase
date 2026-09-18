import { z } from "zod";
import { requireAdmin } from "../../../utils/auth";
import { useSupabaseAdmin } from "../../../utils/db/client";

const editableValuesSchema = z
  .object({
    performance: z.string().nullable(),
    status: z.string().nullable(),
    reviewed_status: z.enum(["waiting", "accepted", "rejected"]).nullable(),
    note: z.string().nullable(),
    highlight: z.boolean().nullable(),
    source_id: z.number().int().positive().nullable(),
    suggestions: z.string().nullable(),
    character_name: z.string().nullable(),
  })
  .strict();

const bodySchema = z
  .object({
    canonicalId: z.number().int().positive(),
    workIds: z.array(z.number().int().positive()).min(2).max(100),
    updates: editableValuesSchema,
  })
  .strict();

export default defineEventHandler(async (event) => {
  const admin = requireAdmin(event);
  const parsedBody = bodySchema.safeParse(await readBody(event));
  if (!parsedBody.success) {
    throw createError({
      statusCode: 400,
      message: "Invalid duplicate merge input",
    });
  }

  const { canonicalId, workIds, updates } = parsedBody.data;
  if (
    new Set(workIds).size !== workIds.length ||
    !workIds.includes(canonicalId)
  ) {
    throw createError({
      statusCode: 400,
      message: "Invalid duplicate merge group",
    });
  }

  const supabaseAdmin = useSupabaseAdmin(event);
  const { data, error } = await supabaseAdmin.rpc(
    "merge_work_duplicates_atomic",
    {
      p_canonical_id: canonicalId,
      p_work_ids: workIds,
      p_updates: updates,
      p_admin_id: admin.id,
    },
  );

  if (error?.code === "40001") {
    throw createError({
      statusCode: 409,
      statusMessage: "DUPLICATE_GROUP_CHANGED",
      message: "This duplicate group changed. Reload it before merging.",
    });
  }
  if (error?.code === "22023" || error?.code === "23503") {
    throw createError({
      statusCode: 422,
      message: "Invalid duplicate merge values",
    });
  }
  if (error) {
    console.error("Failed to merge duplicate work group:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to merge duplicate work group",
    });
  }

  return data;
});
