import type { Database } from "@app/supabase";

type QueueFieldsThatMayBeNull =
  | "dubbing_language"
  | "archive_reason"
  | "archive_details"
  | "detected_regions"
  | "candidate_sections"
  | "episode_number"
  | "error_message"
  | "language"
  | "requested_by"
  | "season_number"
  | "wikipedia_language";

type QueueRow = Omit<
  Database["public"]["Functions"]["get_media_queue_items"]["Returns"][number],
  QueueFieldsThatMayBeNull
> & {
  dubbing_language: string | null;
  archive_reason: string | null;
  archive_details: string | null;
  detected_regions: unknown;
  candidate_sections: unknown;
  episode_number: number | null;
  error_message: string | null;
  language: string | null;
  requested_by: string | null;
  season_number: number | null;
  wikipedia_language: string | null;
};

export type QueueItem = QueueRow & { language?: string | null };
