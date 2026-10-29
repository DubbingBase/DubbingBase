import type { Database } from "@app/supabase";

export type AdminAuditLog = Pick<
  Database["public"]["Tables"]["audit_logs"]["Row"],
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
