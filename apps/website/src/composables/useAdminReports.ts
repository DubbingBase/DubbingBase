import type { Database } from "@app/supabase";

type UserReport = Database["public"]["Tables"]["user_reports"]["Row"];
type UserReportStatus = Database["public"]["Enums"]["user_report_status"];

export const ADMIN_REPORTS_PAGE_SIZE = 50;

export const useAdminReports = () => {
  const supabase = useSupabaseClient();

  const fetchReports = async (page: number) => {
    const firstRow = (page - 1) * ADMIN_REPORTS_PAGE_SIZE;
    const { data, count, error } = await supabase
      .from("user_reports")
      .select("id,reason,details,target_url,reporter_id,status,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(firstRow, firstRow + ADMIN_REPORTS_PAGE_SIZE - 1);

    if (error) throw error;

    return { reports: data ?? [], total: count ?? 0 };
  };

  const updateReportStatus = async (id: UserReport["id"], status: UserReportStatus) => {
    const { error } = await supabase.from("user_reports").update({ status }).eq("id", id);

    if (error) throw error;
  };

  return { fetchReports, updateReportStatus };
};
