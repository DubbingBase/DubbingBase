import type { Database } from "@app/supabase";

type QueueFieldsThatMayBeNull =
  | "dubbing_language"
  | "episode_number"
  | "error_message"
  | "language"
  | "season_number"
  | "wikipedia_language";

type QueueRow = Omit<
  Database["public"]["Functions"]["get_media_queue_items"]["Returns"][number],
  QueueFieldsThatMayBeNull
> & {
  dubbing_language: string | null;
  episode_number: number | null;
  error_message: string | null;
  language: string | null;
  season_number: number | null;
  wikipedia_language: string | null;
};

type RegionalReviewQueueRow = Omit<
  Database["public"]["Functions"]["get_regional_review_queue_items"]["Returns"][number],
  QueueFieldsThatMayBeNull | "review_note"
> & {
  dubbing_language: string | null;
  episode_number: number | null;
  error_message: string | null;
  language?: string | null;
  review_note: string | null;
  season_number: number | null;
  wikipedia_language: string | null;
};

export type QueueItem =
  | (QueueRow & { language?: string | null; review_note?: string | null })
  | RegionalReviewQueueRow;
