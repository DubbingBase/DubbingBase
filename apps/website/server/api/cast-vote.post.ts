import { isRecord } from "@app/shared-logic";
import { resolveUser } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

const voteTypes = ["up", "down"] as const;
type VoteType = (typeof voteTypes)[number];

function isVoteType(value: unknown): value is VoteType {
  return typeof value === "string" && voteTypes.some((voteType) => voteType === value);
}

export default defineEventHandler(async (event) => {
  const user = await resolveUser(event);
  if (!user) {
    throw createError({ statusCode: 401, message: "Unauthorized" });
  }

  const body: unknown = await readBody(event);
  if (!isRecord(body)) {
    throw createError({
      statusCode: 400,
      message: "Missing work_id or vote_type",
    });
  }
  const { work_id, vote_type } = body;

  if (!work_id || !vote_type) {
    throw createError({
      statusCode: 400,
      message: "Missing work_id or vote_type",
    });
  }

  if (!isVoteType(vote_type)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid vote_type. Must be "up" or "down"',
    });
  }

  const workId =
    typeof work_id === "number"
      ? work_id
      : typeof work_id === "string" && /^[1-9]\d*$/.test(work_id)
        ? Number(work_id)
        : NaN;
  if (!Number.isSafeInteger(workId) || workId <= 0) {
    throw createError({ statusCode: 400, message: "Invalid work_id" });
  }

  const supabaseAdmin = event.context.supabaseAdmin || useSupabaseAdmin();

  const { error } = await supabaseAdmin.from("votes").upsert(
    {
      user_id: user.id,
      work_id: workId,
      vote_type,
    },
    {
      onConflict: "user_id,work_id",
    },
  );

  if (error) {
    console.error("Error upserting vote:", error);
    throw createError({
      statusCode: 500,
      message: "Failed to cast vote",
    });
  }

  return { success: true };
});
