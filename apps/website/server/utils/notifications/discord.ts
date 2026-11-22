import { resolveMediaImage, readProperty } from "@app/shared-logic";
import type { H3Event } from "h3";

export type QueueName = "wiki_discovery" | "wiki_check" | "wiki_extract" | string;
export type DiscordNotificationCategory = "general" | "discovery" | "check" | "extract";

export interface DiscordWebhookOptions {
  queue?: QueueName;
  url?: string;
  imageUrl?: string;
  color?: number;
  event?: H3Event;
  category?: DiscordNotificationCategory;
  /**
   * Routine progress message (enqueued, discovery skipped/completed). Logged to the
   * console only, unless DISCORD_NOTIFY_ROUTINE=true. Outcomes and failures are not routine.
   */
  routine?: boolean;
  /** What the event is about (a media title). Shown first in grouped rows, linked to `url`. */
  subject?: string;
  /** Short context after the subject, for example "movie · EN". */
  tag?: string;
  /** One human sentence for grouped rows. Falls back to the first line of the message. */
  summary?: string;
  /** Labelled details, rendered as embed fields instead of a block of text. */
  fields?: DiscordField[];
}

export interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

/** Cuts text to `max` characters on one line, with an ellipsis. */
export function shortText(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

/** Fields for a failure: where it happened, what went wrong, and optional extra context. */
export function errorFields(
  operation: string,
  error: string,
  extra: DiscordField[] = [],
): DiscordField[] {
  return [
    { name: "Step", value: shortText(operation, 200), inline: true },
    ...extra,
    { name: "Error", value: `\`\`\`${error.replace(/`/g, "'").slice(0, 900)}\`\`\`` },
  ];
}

function normalizeFields(fields?: DiscordField[]): DiscordField[] | undefined {
  const usable = (fields ?? [])
    .filter((field) => field.name.trim() && field.value.trim())
    .slice(0, 25)
    .map((field) => ({
      name: field.name.slice(0, 256),
      value: field.value.slice(0, 1024),
      ...(field.inline ? { inline: true } : {}),
    }));
  return usable.length > 0 ? usable : undefined;
}

function shouldSkipRoutine(options?: DiscordWebhookOptions): boolean {
  if (options?.routine !== true) return false;

  let config: unknown;
  try {
    config = options.event ? useRuntimeConfig(options.event) : useRuntimeConfig();
  } catch {
    config = undefined;
  }
  const configuredValue = readProperty(config, "discordNotifyRoutine");
  const cloudflareValue = options.event?.context.cloudflare?.env?.DISCORD_NOTIFY_ROUTINE;

  return (
    configuredValue !== true &&
    configuredValue !== "true" &&
    cloudflareValue !== "true" &&
    process.env.DISCORD_NOTIFY_ROUTINE !== "true"
  );
}

function getDiscordWebhookUrls(queue?: string, event?: H3Event): string[] {
  let config: unknown;
  try {
    config = event ? useRuntimeConfig(event) : useRuntimeConfig();
  } catch {
    config = useRuntimeConfig();
  }
  const configValue = (key: string): unknown => {
    if (typeof config !== "object" || config === null) return undefined;
    return Reflect.get(config, key);
  };
  const cfEnv = event?.context?.cloudflare?.env;
  const targetUrls = new Set<string>();

  const addUrls = (raw: unknown) => {
    if (!raw || typeof raw !== "string") return;
    const split = raw
      .split(/[,;\n]+/)
      .map((u) => u.trim())
      .filter(Boolean);
    for (const u of split) {
      if (u.startsWith("http://") || u.startsWith("https://")) {
        targetUrls.add(u);
      }
    }
  };

  // 1. Check queue-specific webhook variables
  if (queue === "wiki_discovery" || queue === "discovery") {
    addUrls(configValue("discordWebhookDiscoveryUrl"));
    addUrls(cfEnv?.NUXT_DISCORD_WEBHOOK_DISCOVERY_URL);
    addUrls(cfEnv?.DISCORD_WEBHOOK_DISCOVERY_URL);
    addUrls(cfEnv?.DISCORD_DISCOVERY_WEBHOOK_URL);
    addUrls(process.env.NUXT_DISCORD_WEBHOOK_DISCOVERY_URL);
    addUrls(process.env.DISCORD_WEBHOOK_DISCOVERY_URL);
    addUrls(process.env.DISCORD_DISCOVERY_WEBHOOK_URL);
  } else if (queue === "wiki_check" || queue === "check") {
    addUrls(configValue("discordWebhookCheckUrl"));
    addUrls(cfEnv?.NUXT_DISCORD_WEBHOOK_CHECK_URL);
    addUrls(cfEnv?.DISCORD_WEBHOOK_CHECK_URL);
    addUrls(cfEnv?.DISCORD_CHECK_WEBHOOK_URL);
    addUrls(process.env.NUXT_DISCORD_WEBHOOK_CHECK_URL);
    addUrls(process.env.DISCORD_WEBHOOK_CHECK_URL);
    addUrls(process.env.DISCORD_CHECK_WEBHOOK_URL);
  } else if (queue === "wiki_extract" || queue === "extract") {
    addUrls(configValue("discordWebhookExtractUrl"));
    addUrls(cfEnv?.NUXT_DISCORD_WEBHOOK_EXTRACT_URL);
    addUrls(cfEnv?.DISCORD_WEBHOOK_EXTRACT_URL);
    addUrls(cfEnv?.DISCORD_EXTRACT_WEBHOOK_URL);
    addUrls(process.env.NUXT_DISCORD_WEBHOOK_EXTRACT_URL);
    addUrls(process.env.DISCORD_WEBHOOK_EXTRACT_URL);
    addUrls(process.env.DISCORD_EXTRACT_WEBHOOK_URL);
  }

  // 2. Fallback to general admin webhooks if no queue-specific URL was configured
  if (targetUrls.size === 0) {
    addUrls(configValue("discordWebhookUrl"));
    addUrls(configValue("discordWebhookUrl2"));
    addUrls(configValue("discordWebhookUrl3"));
    addUrls(cfEnv?.NUXT_DISCORD_WEBHOOK_URL);
    addUrls(cfEnv?.DISCORD_WEBHOOK_URL);
    addUrls(cfEnv?.DISCORD_ADMIN_WEBHOOK_LOG_URL);
    addUrls(process.env.NUXT_DISCORD_WEBHOOK_URL);
    addUrls(process.env.DISCORD_WEBHOOK_URL);
    addUrls(process.env.DISCORD_ADMIN_WEBHOOK_LOG_URL);
    addUrls(process.env.NUXT_DISCORD_WEBHOOK_URL_1);
    addUrls(process.env.DISCORD_WEBHOOK_URL_1);
    addUrls(process.env.NUXT_DISCORD_WEBHOOK_URL_2);
    addUrls(process.env.DISCORD_WEBHOOK_URL_2);
    addUrls(process.env.NUXT_DISCORD_WEBHOOK_URL_3);
    addUrls(process.env.DISCORD_WEBHOOK_URL_3);
  }

  return Array.from(targetUrls);
}

export function normalizeDiscordUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  const withoutLocale = path.replace(/^\/(?:fr|en|es|ja)(?=\/|$)/, "");
  return `https://dubbingbase.com/fr${withoutLocale}`;
}

function categoryFor(options?: DiscordWebhookOptions): DiscordNotificationCategory {
  if (options?.category) return options.category;
  if (options?.queue === "wiki_discovery" || options?.queue === "discovery") {
    return "discovery";
  }
  if (options?.queue === "wiki_check" || options?.queue === "check") {
    return "check";
  }
  if (options?.queue === "wiki_extract" || options?.queue === "extract") {
    return "extract";
  }
  return "general";
}

export function buildDiscordEmbed(
  title: string,
  message: string,
  options?: DiscordWebhookOptions,
): Record<string, unknown> {
  const category = categoryFor(options);
  const label = category.charAt(0).toUpperCase() + category.slice(1);
  const description =
    message.length > 2000 ? message.slice(0, 1980) + "\n... (truncated)" : message;
  const embed: Record<string, unknown> = {
    title: `[${label}] ${title}`.slice(0, 250),
    description,
    color: options?.color ?? 0x2a2a2a,
    timestamp: new Date().toISOString(),
    author: { name: `DubbingBase • ${label}` },
    footer: { text: "DubbingBase Admin Notifications" },
  };
  if (options?.url) embed.url = normalizeDiscordUrl(options.url);
  const fields = normalizeFields(options?.fields);
  if (fields) embed.fields = fields;
  const imageUrl = resolveMediaImage(options?.imageUrl, { tmdbSize: "w500" });
  if (imageUrl) embed.image = { url: imageUrl };
  return embed;
}

function isWikiCheckQueue(queue?: string): boolean {
  return queue === "wiki_check" || queue === "check";
}

function resolveDeliveryUrls(options?: DiscordWebhookOptions): string[] {
  const webhookUrls = getDiscordWebhookUrls(options?.queue, options?.event);
  return isWikiCheckQueue(options?.queue) ? webhookUrls.slice(0, 1) : webhookUrls;
}

async function postEmbeds(
  deliveryUrls: string[],
  embeds: Record<string, unknown>[],
  options?: DiscordWebhookOptions,
): Promise<void> {
  const payload = JSON.stringify({ embeds });
  const wikiCheck = isWikiCheckQueue(options?.queue);

  await Promise.allSettled(
    deliveryUrls.map(async (webhookUrl) => {
      try {
        const res = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(
            wikiCheck
              ? `[Discord] wiki_check notification POST failed (status ${res.status}):`
              : `[Discord] Webhook API error (${webhookUrl.slice(0, 35)}... status ${res.status}):`,
            errText,
          );
        }
      } catch (err) {
        console.error(
          wikiCheck
            ? "[Discord] wiki_check notification POST failed:"
            : `[Discord] Webhook fetch error (${webhookUrl.slice(0, 35)}...):`,
          err,
        );
      }
    }),
  );
}

function logMissingWebhook(options?: DiscordWebhookOptions) {
  console.error(
    isWikiCheckQueue(options?.queue)
      ? "[Discord] wiki_check notification not attempted: no valid queue-specific or fallback webhook URL configured"
      : "[Discord] Webhook URL missing, skipping notification",
  );
}

interface DigestEntry {
  title: string;
  message: string;
  options?: DiscordWebhookOptions;
}

/** Notifications buffered per request, flushed as grouped messages. */
const openDigests = new WeakMap<H3Event, DigestEntry[]>();

/**
 * Start grouping this request's notifications. Calls to `sendDiscordAdminNotification` that pass
 * the same `event` are buffered until `flushDiscordDigest(event)`, which posts one grouped
 * message per destination instead of one message per notification.
 */
export function beginDiscordDigest(event: H3Event): void {
  if (!openDigests.has(event)) openDigests.set(event, []);
}

export type DiscordSeverity = "success" | "info" | "warning" | "error";

const SEVERITY_RANK: Record<DiscordSeverity, number> = {
  info: 0,
  success: 1,
  warning: 2,
  error: 3,
};
const SEVERITY_COLOR: Record<DiscordSeverity, number> = {
  info: 0x5865f2,
  success: 0x57f287,
  warning: 0xfee75c,
  error: 0xed4245,
};
const SEVERITY_ICON: Record<DiscordSeverity, string> = {
  info: "ℹ️",
  success: "✅",
  warning: "⚠️",
  error: "❌",
};

export function severityOf(title: string, options?: DiscordWebhookOptions): DiscordSeverity {
  if (options?.color === SEVERITY_COLOR.error) return "error";
  if (options?.color === SEVERITY_COLOR.warning) return "warning";
  if (options?.color === SEVERITY_COLOR.success) return "success";
  if (/fail|error/i.test(title)) return "error";
  if (/processed|completed|enqueued/i.test(title)) return "success";
  return "info";
}

/** Folds a multi-line bullet message into one short line for a digest row. */
export function condenseMessage(message: string, max: number): string {
  const folded = message
    .split("\n")
    .map((line) => line.replace(/^[•\-*]\s*/, "").trim())
    .filter(Boolean)
    .join(" · ");
  return folded.length > max ? `${folded.slice(0, max - 1)}…` : folded;
}

// Discord webhook limits: 10 embeds per message, 6000 characters of embed text in total
// (title, description, author name, footer), 4096 per description.
const MAX_EMBEDS = 10;
const MAX_EMBED_CHARS = 6000;
const MAX_DESCRIPTION_CHARS = 4096;
const MAX_ROW_CHARS = 140;
const MAX_DETAIL_CHARS = 700;
/** Follow-up messages are capped so one noisy batch cannot flood the channel or webhook rate limit. */
const MAX_MESSAGES = 4;
const FOOTER_TEXT = "DubbingBase Admin Notifications";

/** Characters Discord counts toward the 6000 limit for one embed. */
export function embedChars(embed: Record<string, unknown>): number {
  const text = (value: unknown) => (typeof value === "string" ? value.length : 0);
  const nested = (value: unknown, key: string) => text(readProperty(value, key));
  const fields = Array.isArray(embed.fields) ? embed.fields : [];
  const fieldChars = fields.reduce<number>(
    (sum, field) => sum + nested(field, "name") + nested(field, "value"),
    0,
  );
  return (
    text(embed.title) +
    text(embed.description) +
    nested(embed.author, "name") +
    nested(embed.footer, "text") +
    fieldChars
  );
}

interface DigestRow extends DigestEntry {
  count: number;
  severity: DiscordSeverity;
  line: string;
  detail: Record<string, unknown> | null;
}

/**
 * Groups entries into as few Discord messages as the limits allow. Rows are ordered by severity,
 * so the first message always carries the problems. Nothing is dropped until MAX_MESSAGES is hit;
 * overflow goes to follow-up messages.
 */
export function buildDigestMessages(entries: DigestEntry[]): Record<string, unknown>[][] {
  if (entries.length === 1) {
    const [only] = entries;
    return only ? [[buildDiscordEmbed(only.title, only.message, only.options)]] : [];
  }

  // Identical notifications (same title and text) collapse into one row with a count.
  const grouped = new Map<string, { entry: DigestEntry; count: number }>();
  for (const entry of entries) {
    const key = `${entry.title}\u0000${entry.message}`;
    const existing = grouped.get(key);
    if (existing) existing.count++;
    else grouped.set(key, { entry, count: 1 });
  }

  const rows: DigestRow[] = [...grouped.values()]
    .map(({ entry, count }): DigestRow => {
      const severity = severityOf(entry.title, entry.options);
      const subject = entry.options?.subject ?? entry.title;
      const linked = entry.options?.url
        ? `[${subject}](${normalizeDiscordUrl(entry.options.url)})`
        : `**${subject}**`;
      const tag = entry.options?.tag ? ` · ${entry.options.tag}` : "";
      const times = count > 1 ? ` ×${count}` : "";
      // A hand-written summary is self-contained; otherwise lead with the event title.
      const kind = entry.options?.summary || !entry.options?.subject ? "" : `${entry.title}: `;
      const what = entry.options?.summary ?? condenseMessage(entry.message, MAX_ROW_CHARS);
      const line = `${SEVERITY_ICON[severity]} ${linked}${tag}${times}\n  ↳ ${kind}${shortText(what, MAX_ROW_CHARS)}`;
      // Problems get an embed of their own, with labelled fields when the caller provided them.
      const detailFields = normalizeFields(entry.options?.fields);
      // A summary without fields already says everything; repeating the raw text is noise.
      const needsDetail =
        SEVERITY_RANK[severity] >= SEVERITY_RANK.warning &&
        (Boolean(detailFields) || !entry.options?.summary);
      const detail = needsDetail
        ? {
            title:
              `${SEVERITY_ICON[severity]} ${entry.title}${entry.options?.subject ? ` — ${entry.options.subject}` : ""}`.slice(
                0,
                250,
              ),
            ...(detailFields
              ? { fields: detailFields }
              : { description: entry.message.slice(0, MAX_DETAIL_CHARS) }),
            color: SEVERITY_COLOR[severity],
            ...(entry.options?.url ? { url: normalizeDiscordUrl(entry.options.url) } : {}),
          }
        : null;
      return { ...entry, count, severity, line, detail };
    })
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  const counts: Record<DiscordSeverity, number> = { info: 0, success: 0, warning: 0, error: 0 };
  let worst: DiscordSeverity = "info";
  for (const row of rows) {
    counts[row.severity] += row.count;
    if (SEVERITY_RANK[row.severity] > SEVERITY_RANK[worst]) worst = row.severity;
  }
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const headline = `${total} events — ${(["error", "warning", "success", "info"] as const)
    .filter((severity) => counts[severity] > 0)
    .map((severity) => `${counts[severity]} ${severity}`)
    .join(", ")}`;

  const categories = new Set(rows.map((row) => categoryFor(row.options)));
  const [singleCategory] = categories;
  const label =
    categories.size === 1 && singleCategory
      ? singleCategory.charAt(0).toUpperCase() + singleCategory.slice(1)
      : "Queue";
  const author = `DubbingBase • ${label}`;
  // Title (with part suffix) + author + footer, counted against every message's budget.
  const fixedChars = headline.length + 12 + author.length + FOOTER_TEXT.length + 40;

  // Greedy packing: a row joins the current message while every limit still holds.
  const packs: DigestRow[][] = [];
  let current: DigestRow[] = [];
  let currentChars = fixedChars;
  let currentEmbeds = 1;
  let currentDescription = 0;
  let skipped = 0;
  for (const row of rows) {
    const lineChars = row.line.length + 1;
    const detailChars = row.detail ? embedChars(row.detail) : 0;
    const fits =
      currentChars + lineChars + detailChars <= MAX_EMBED_CHARS &&
      currentEmbeds + (row.detail ? 1 : 0) <= MAX_EMBEDS &&
      currentDescription + lineChars <= MAX_DESCRIPTION_CHARS;
    if (!fits && current.length > 0) {
      if (packs.length + 1 >= MAX_MESSAGES) {
        skipped += row.count;
        continue;
      }
      packs.push(current);
      current = [];
      currentChars = fixedChars;
      currentEmbeds = 1;
      currentDescription = 0;
    }
    current.push(row);
    currentChars += lineChars + detailChars;
    currentEmbeds += row.detail ? 1 : 0;
    currentDescription += lineChars;
  }
  if (current.length > 0) packs.push(current);

  const thumb = rows
    .map((row) => resolveMediaImage(row.options?.imageUrl, { tmdbSize: "w500" }))
    .find((url) => Boolean(url));

  return packs.map((pack, index) => {
    const part = packs.length > 1 ? ` (${index + 1}/${packs.length})` : "";
    const lastPart = index === packs.length - 1;
    const description = pack.map((row) => row.line).join("\n");
    const summary: Record<string, unknown> = {
      title: `${headline}${part}`.slice(0, 250),
      description:
        lastPart && skipped > 0
          ? `${description}\n… and ${skipped} more event(s), see logs.`.slice(
              0,
              MAX_DESCRIPTION_CHARS,
            )
          : description,
      color: SEVERITY_COLOR[worst],
      timestamp: new Date().toISOString(),
      author: { name: author },
      footer: { text: FOOTER_TEXT },
    };
    if (thumb && index === 0) summary.thumbnail = { url: thumb };
    const details = pack.flatMap((row) => (row.detail ? [row.detail] : []));
    return [summary, ...details];
  });
}

/** Posts everything buffered for this request, one message per destination. */
export async function flushDiscordDigest(event: H3Event): Promise<void> {
  const entries = openDigests.get(event);
  openDigests.delete(event);
  if (!entries || entries.length === 0) return;

  try {
    const byDestination = new Map<string, { urls: string[]; entries: DigestEntry[] }>();
    for (const entry of entries) {
      const urls = resolveDeliveryUrls(entry.options);
      if (urls.length === 0) {
        logMissingWebhook(entry.options);
        continue;
      }
      const key = urls.join("\u0000");
      const group = byDestination.get(key) ?? { urls, entries: [] };
      group.entries.push(entry);
      byDestination.set(key, group);
    }

    await Promise.all(
      [...byDestination.values()].map(async (group) => {
        // Sequential so follow-up parts arrive in order.
        for (const embeds of buildDigestMessages(group.entries)) {
          await postEmbeds(group.urls, embeds, group.entries[0]?.options);
        }
      }),
    );
  } catch (err) {
    console.error("[Discord] Digest flush exception:", err);
  }
}

export async function sendDiscordAdminNotification(
  title: string,
  message: string,
  options?: DiscordWebhookOptions,
) {
  if (shouldSkipRoutine(options)) {
    console.info(`[Discord] routine notification suppressed: ${title}`);
    return;
  }

  const buffered = options?.event ? openDigests.get(options.event) : undefined;
  if (buffered) {
    buffered.push({ title, message, options });
    return;
  }

  const deliveryUrls = resolveDeliveryUrls(options);
  if (deliveryUrls.length === 0) {
    logMissingWebhook(options);
    return;
  }

  try {
    await postEmbeds(deliveryUrls, [buildDiscordEmbed(title, message, options)], options);
  } catch (err) {
    console.error("[Discord] Notification exception:", err);
  }
}
