import type { Tables } from "@app/supabase/types";

export type AdminAuditLog = Pick<
  Tables<"audit_logs">,
  | "id"
  | "user_id"
  | "created_at"
  | "action"
  | "entity_type"
  | "entity_id"
  | "points_awarded"
  | "reverted_at"
>;

export const useAdminAuditLogs = () => {
  const supabase = useSupabaseClient();

  const fetchAuditLogs = async (): Promise<AdminAuditLog[]> => {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id,user_id,created_at,action,entity_type,entity_id,points_awarded,reverted_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    return data ?? [];
  };

  return { fetchAuditLogs };
};
