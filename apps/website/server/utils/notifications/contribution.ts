import type { User } from "@supabase/supabase-js";
import type { H3Event } from "h3";
import { scheduleBackgroundTask } from "../background";
import { sendDiscordAdminNotification } from "./discord";

export type ContributionEdit = {
  /** Human-readable entity kind, for example "voice actor". */
  entity: string;
  entityId: string | number;
  /** Short summary of what changed, for example the edited field names. */
  detail: string;
  /** Site path of the edited page, linked from the notification. */
  path: string;
};

/**
 * Open editing has no approval queue, so each contributor edit is posted to the admin
 * Discord channel for after-the-fact review. Admin edits are skipped, and delivery runs in
 * the background so a webhook failure never affects the edit itself.
 */
export function notifyContributionEdit(event: H3Event, user: User, edit: ContributionEdit): void {
  if (user.app_metadata?.role === "admin") return;
  scheduleBackgroundTask(
    event,
    () =>
      sendDiscordAdminNotification(
        "Community edit",
        `User ${user.id} edited ${edit.entity} #${edit.entityId}: ${edit.detail}`,
        { event, url: edit.path },
      ),
    "contribution-edit-notification",
  );
}
