import { randomUUID } from "node:crypto";
import { isRecord } from "@app/shared-logic";
import { defineAdminHandler } from "../utils/auth-handlers";
import { useSupabaseAdmin } from "../utils/db/client";
import { evaluateRevert, type RevertPlan } from "../utils/history-revert";
import { currentRowKey, loadCurrentRows } from "../utils/history-store";

type AdminClient = ReturnType<typeof useSupabaseAdmin>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revertError(statusCode: number, message: string) {
  return createError({ statusCode, statusMessage: message, message });
}

function mapRpcError(code: string | undefined): never {
  if (code === "42501" || code === "28000") throw revertError(403, "This revert is not authorized");
  if (code === "P0002") throw revertError(404, "The item no longer exists");
  if (
    code === "40001" ||
    code === "PT409" ||
    code === "23505" ||
    code === "55000" ||
    code === "23503"
  ) {
    throw revertError(409, "This changed since it was loaded, or is referenced elsewhere");
  }
  if (code === "22023" || code === "22P02" || code === "22003") {
    throw revertError(422, "The previous value can no longer be restored");
  }
  console.error("History revert failed", { code });
  throw revertError(500, "Revert failed; no changes were saved");
}

async function freshWorkUpdatedAt(supabase: AdminClient, workId: number): Promise<string> {
  const { data, error } = await supabase
    .from("work")
    .select("updated_at")
    .eq("id", workId)
    .single();
  if (error || !data) throw revertError(409, "This changed since it was loaded");
  return data.updated_at;
}

/** Applies a revert plan through the same audited RPCs the editors use, as the acting admin. */
async function applyPlan(supabase: AdminClient, adminId: string, plan: RevertPlan): Promise<void> {
  if (plan.kind === "voice_actor") {
    const { error } = await supabase.rpc("controlled_update_voice_actor", {
      p_actor_id: adminId,
      p_voice_actor_id: plan.id,
      p_payload: plan.updates,
      p_expected_updated_at: plan.expectedUpdatedAt,
      p_request_id: randomUUID(),
    });
    if (error) mapRpcError(error.code);
    return;
  }
  if (plan.kind === "studio") {
    const { error } = await supabase.rpc("controlled_save_studio", {
      p_actor_id: adminId,
      p_studio_id: plan.id,
      p_expected_updated_at: plan.expectedUpdatedAt,
      p_request_id: randomUUID(),
      p_updates: plan.updates,
    });
    if (error) mapRpcError(error.code);
    return;
  }
  if (plan.kind === "work_delete") {
    const { error } = await supabase.rpc("delete_voice_actor_work_link", {
      p_user_id: adminId,
      p_request_id: randomUUID(),
      p_work_id: plan.id,
      p_expected_updated_at: plan.expectedUpdatedAt,
    });
    if (error) mapRpcError(error.code);
    return;
  }

  let expectedUpdatedAt = plan.expectedUpdatedAt;
  if (plan.performance !== null) {
    const { error } = await supabase.rpc("update_voice_actor_work_performance", {
      p_user_id: adminId,
      p_request_id: randomUUID(),
      p_work_id: plan.id,
      p_expected_updated_at: expectedUpdatedAt,
      p_performance: plan.performance,
    });
    if (error) mapRpcError(error.code);
    expectedUpdatedAt = await freshWorkUpdatedAt(supabase, plan.id);
  }
  // An admin edit auto-verifies a credit, so always restore the status the entry started from.
  const { data: work, error: workError } = await supabase
    .from("work")
    .select("reviewed_status")
    .eq("id", plan.id)
    .single();
  if (workError || !work) throw revertError(409, "This changed since it was loaded");
  if (work.reviewed_status !== plan.reviewedStatus) {
    const { error } = await supabase.rpc("update_work_review_status_controlled", {
      p_actor_id: adminId,
      p_request_id: randomUUID(),
      p_work_id: plan.id,
      p_expected_updated_at: expectedUpdatedAt,
      p_reviewed_status: plan.reviewedStatus,
    });
    if (error) mapRpcError(error.code);
  }
}

export default defineAdminHandler(async (event, admin) => {
  const body: unknown = await readBody(event);
  if (
    !isRecord(body) ||
    typeof body.audit_log_id !== "string" ||
    !uuidPattern.test(body.audit_log_id)
  ) {
    throw revertError(400, "audit_log_id must be a UUID");
  }
  if (Object.keys(body).some((key) => key !== "audit_log_id")) {
    throw revertError(400, "Revert contains an unknown field");
  }

  const supabase = event.context.supabaseAdmin || useSupabaseAdmin(event);
  const { data: audit, error: auditError } = await supabase
    .from("audit_logs")
    .select("id, entity_type, entity_id, previous_value, new_value, reverted_at")
    .eq("id", body.audit_log_id)
    .maybeSingle();
  if (auditError) {
    console.error("Failed to read audit entry for revert", { code: auditError.code });
    throw revertError(500, "Revert failed; no changes were saved");
  }
  if (!audit) throw revertError(404, "History entry not found");

  const current = await loadCurrentRows(supabase, [audit]);
  const evaluation = evaluateRevert(
    audit,
    current.get(currentRowKey(audit.entity_type, audit.entity_id)) ?? null,
  );
  if (!evaluation.ok) {
    if (evaluation.reason === "unsupported")
      throw revertError(422, "This entry cannot be reverted");
    throw revertError(409, "This changed since it was loaded, or was already reverted");
  }

  await applyPlan(supabase, admin.id, evaluation.plan);

  // Marking the original is a convenience for the history view: the restored values already
  // make the entry non-revertable, so a failure here must not fail the revert itself.
  const { error: markError } = await supabase
    .from("audit_logs")
    .update({ reverted_at: new Date().toISOString() })
    .eq("id", audit.id)
    .is("reverted_at", null);
  if (markError)
    console.error("Failed to mark history entry as reverted", { code: markError.code });

  return { success: true };
});
