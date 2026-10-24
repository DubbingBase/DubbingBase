import { requireUser } from "../utils/auth";
import { isTaskClaimId } from "../utils/contribution/task-submission-validation";
import { useSupabaseAdmin } from "../utils/db/client";

const categories = ["enrich_voice_actor", "enrich_studio"] as const;
type TaskCategory = (typeof categories)[number];
type RequestCategory = TaskCategory | "any";

function isRequestCategory(value: string): value is RequestCategory {
  return value === "any" || categories.some((category) => category === value);
}

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const body: unknown = await readBody(event);

  if (
    !body ||
    typeof body !== "object" ||
    !("category" in body) ||
    typeof body.category !== "string" ||
    !isRequestCategory(body.category)
  ) {
    throw createError({ statusCode: 400, message: "Invalid category" });
  }

  const category = body.category;
  const skipClaimId = "skipClaimId" in body ? body.skipClaimId : undefined;
  if (skipClaimId !== undefined && !isTaskClaimId(skipClaimId)) {
    throw createError({ statusCode: 400, message: "Invalid claim id" });
  }

  const supabaseAdmin = useSupabaseAdmin(event);
  const { data, error } =
    skipClaimId === undefined
      ? await supabaseAdmin.rpc("claim_gamification_task_retry_safe", {
          p_category: category,
          p_user_id: user.id,
        })
      : await supabaseAdmin.rpc("skip_gamification_task_retry_safe", {
          p_category: category,
          p_user_id: user.id,
          p_skip_claim_id: skipClaimId,
        });

  if (error) {
    console.error("Failed to claim gamification task:", error);
    throw createError({ statusCode: 500, message: "Internal server error" });
  }

  const claim = data?.[0];
  if (!claim) {
    console.error("Claim RPC returned no result row");
    throw createError({ statusCode: 500, message: "Internal server error" });
  }

  return {
    task: claim.task,
    category: claim.category,
    claimId: claim.claim_id,
    expiresAt: claim.expires_at,
  };
});
