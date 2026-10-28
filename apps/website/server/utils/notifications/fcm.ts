import { useSupabaseAdmin } from "../db/client";

const FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const MAX_INSTALLATIONS_PER_EVENT = 500;
const SEND_CONCURRENCY = 10;
const MAX_DISPATCH_TIME_MS = 20_000;
const MAX_FETCH_TIME_MS = 5_000;

interface FcmRuntimeConfig {
  firebaseProjectId: string;
  firebaseClientEmail: string;
  firebasePrivateKey: string;
}

interface FcmErrorResponse {
  error?: {
    details?: Array<{ errorCode?: string }>;
    status?: string;
  };
}

interface PushMessage {
  title: string;
  body: string;
  link: string;
  eventId: string;
}

export interface PushSendResult {
  attempted: number;
  sent: number;
  invalidTokens: number;
  truncated: boolean;
}

export interface PushInstallationCandidate {
  user_id: string;
  fcm_token: string;
  platform: string;
  enabled: boolean;
}

export function eligiblePushTokens(
  subscriptions: Array<{ user_id: string }>,
  enabledPreferences: Array<{ user_id: string }>,
  installations: PushInstallationCandidate[],
): string[] {
  const followers = new Set(subscriptions.map((row) => row.user_id));
  const enabledUsers = new Set(
    enabledPreferences.map((row) => row.user_id).filter((userId) => followers.has(userId)),
  );
  return [
    ...new Set(
      installations
        .filter(
          (installation) =>
            enabledUsers.has(installation.user_id) &&
            installation.enabled &&
            (installation.platform === "android" || installation.platform === "ios"),
        )
        .map((installation) => installation.fcm_token),
    ),
  ];
}

function encodeBase64Url(value: string | Uint8Array): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function decodePem(value: string): Uint8Array {
  const encoded = value
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
}

async function createAccessToken(
  config: FcmRuntimeConfig,
  deadline: number,
): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = encodeBase64Url(
    JSON.stringify({
      iss: config.firebaseClientEmail,
      scope: FCM_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    }),
  );
  const unsignedToken = `${header}.${claims}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    decodePem(config.firebasePrivateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken),
  );
  const assertion = `${unsignedToken}.${encodeBase64Url(new Uint8Array(signature))}`;
  const response = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  }, deadline);
  if (!response.ok) {
    console.error("[FCM] OAuth token request failed", { status: response.status });
    throw new Error("FCM authentication failed");
  }
  const payload: unknown = await response.json();
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("access_token" in payload) ||
    typeof payload.access_token !== "string"
  ) {
    throw new Error("FCM authentication response was invalid");
  }
  return payload.access_token;
}

async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit,
  deadline: number,
): Promise<Response> {
  const remainingMs = Math.min(MAX_FETCH_TIME_MS, deadline - Date.now());
  if (remainingMs <= 0) throw new Error("FCM dispatch time budget expired");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), remainingMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function validNotificationLink(link: string): string | null {
  try {
    const url = new URL(link);
    if (url.protocol !== "https:" || url.hostname !== "dubbingbase.com") return null;
    return url.href;
  } catch {
    return null;
  }
}

function errorCodeFrom(payload: FcmErrorResponse): string | undefined {
  return payload.error?.details?.find((detail) => detail.errorCode)?.errorCode;
}

function parseFcmError(payload: unknown): FcmErrorResponse {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) return {};
  const value = payload.error;
  if (typeof value !== "object" || value === null) return {};
  const status = "status" in value && typeof value.status === "string"
    ? value.status
    : undefined;
  const details = "details" in value && Array.isArray(value.details)
    ? value.details.flatMap((detail) => {
        if (
          typeof detail === "object" &&
          detail !== null &&
          "errorCode" in detail &&
          typeof detail.errorCode === "string"
        ) {
          return [{ errorCode: detail.errorCode }];
        }
        return [];
      })
    : undefined;
  return { error: { status, details } };
}

export async function sendToken(
  projectId: string,
  accessToken: string,
  token: string,
  message: PushMessage,
  deadline = Date.now() + MAX_DISPATCH_TIME_MS,
): Promise<"sent" | "invalid" | "failed"> {
  const endpoint = new URL(
    `/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
    "https://fcm.googleapis.com",
  ).href;
  const body = JSON.stringify({
    message: {
      token,
      data: {
        title: message.title,
        body: message.body,
        link: message.link,
        eventId: message.eventId,
      },
      webpush: { headers: { TTL: "86400" } },
    },
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response: Response;
    try {
      response = await fetchWithTimeout(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body,
      }, deadline);
    } catch {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      console.warn("[FCM] Provider request failed", { kind: "network" });
      return "failed";
    }
    if (response.ok) return "sent";

    let error: FcmErrorResponse = {};
    try {
      const payload: unknown = await response.json();
      error = parseFcmError(payload);
    } catch {
      // The status code is enough to classify the failure when the provider body is absent.
    }
    const errorCode = errorCodeFrom(error);
    if (errorCode === "UNREGISTERED") return "invalid";
    if ((response.status === 429 || response.status >= 500) && attempt === 0) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      continue;
    }
    console.warn("[FCM] Provider rejected a message", {
      status: response.status,
      errorCode: errorCode ?? error.error?.status ?? "unknown",
    });
    return "failed";
  }
  return "failed";
}

async function sendInBatches(
  projectId: string,
  accessToken: string,
  tokens: string[],
  message: PushMessage,
  deadline: number,
): Promise<{ attempted: number; sent: number; invalidTokens: string[] }> {
  let attempted = 0;
  let sent = 0;
  const invalidTokens: string[] = [];
  for (let offset = 0; offset < tokens.length; offset += SEND_CONCURRENCY) {
    if (Date.now() >= deadline) break;
    const batch = tokens.slice(offset, offset + SEND_CONCURRENCY);
    attempted += batch.length;
    const results = await Promise.all(
      batch.map((token) => sendToken(projectId, accessToken, token, message, deadline)),
    );
    for (let index = 0; index < results.length; index += 1) {
      if (results[index] === "sent") sent += 1;
      if (results[index] === "invalid") invalidTokens.push(batch[index]);
    }
  }
  return { attempted, sent, invalidTokens };
}

export async function notifyVoiceActorFollowers(
  voiceActorIds: number | number[],
  message: PushMessage,
): Promise<PushSendResult> {
  const link = validNotificationLink(message.link);
  const actorIds = [...new Set(Array.isArray(voiceActorIds) ? voiceActorIds : [voiceActorIds])];
  if (
    actorIds.length === 0 ||
    actorIds.some((voiceActorId) => !Number.isSafeInteger(voiceActorId) || voiceActorId <= 0) ||
    !link
  ) {
    console.warn("[FCM] Skipping invalid publication event");
    return { attempted: 0, sent: 0, invalidTokens: 0, truncated: false };
  }

  const config = useRuntimeConfig();
  const firebaseConfig: FcmRuntimeConfig = {
    firebaseProjectId: config.firebaseProjectId,
    firebaseClientEmail: config.firebaseClientEmail,
    firebasePrivateKey: config.firebasePrivateKey,
  };
  if (
    !firebaseConfig.firebaseProjectId ||
    !firebaseConfig.firebaseClientEmail ||
    !firebaseConfig.firebasePrivateKey
  ) {
    console.warn("[FCM] Credentials are not configured; push delivery skipped");
    return { attempted: 0, sent: 0, invalidTokens: 0, truncated: false };
  }

  try {
    const supabase = useSupabaseAdmin();
    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("voice_actor_subscriptions")
      .select("user_id")
      .in("voice_actor_id", actorIds);
    if (subscriptionError) throw subscriptionError;
    const userIds = [...new Set((subscriptions ?? []).map((row) => row.user_id))];
    if (userIds.length === 0) return { attempted: 0, sent: 0, invalidTokens: 0, truncated: false };

    const { data: preferences, error: preferenceError } = await supabase
      .from("user_profiles")
      .select("user_id")
      .in("user_id", userIds)
      .eq("push_enabled", true);
    if (preferenceError) throw preferenceError;
    const enabledUserIds = [...new Set((preferences ?? []).map((row) => row.user_id))];
    if (enabledUserIds.length === 0) {
      return { attempted: 0, sent: 0, invalidTokens: 0, truncated: false };
    }
    const { data: installations, error: installationError } = await supabase
      .from("push_installations")
      .select("user_id, fcm_token, platform, enabled")
      .in("user_id", enabledUserIds)
      .eq("enabled", true)
      .limit(MAX_INSTALLATIONS_PER_EVENT + 1);
    if (installationError) throw installationError;
    const tokens = eligiblePushTokens(subscriptions ?? [], preferences ?? [], installations ?? []);
    const truncated = tokens.length > MAX_INSTALLATIONS_PER_EVENT;
    const boundedTokens = tokens.slice(0, MAX_INSTALLATIONS_PER_EVENT);
    if (boundedTokens.length === 0) return { attempted: 0, sent: 0, invalidTokens: 0, truncated };

    const dispatchDeadline = Date.now() + MAX_DISPATCH_TIME_MS;
    const accessToken = await createAccessToken(firebaseConfig, dispatchDeadline);
    const result = await sendInBatches(
      firebaseConfig.firebaseProjectId,
      accessToken,
      boundedTokens,
      { ...message, link },
      dispatchDeadline,
    );
    const dispatchTruncated = truncated || result.attempted < boundedTokens.length;
    if (result.invalidTokens.length > 0) {
      const { error } = await supabase
        .from("push_installations")
        .delete()
        .in("fcm_token", result.invalidTokens);
      if (error) {
        console.warn("[FCM] Invalid token cleanup failed", {
          count: result.invalidTokens.length,
        });
      }
    }
    console.info("[FCM] Event delivery completed", {
      attempted: result.attempted,
      sent: result.sent,
      invalid: result.invalidTokens.length,
      truncated: dispatchTruncated,
    });
    return {
      attempted: result.attempted,
      sent: result.sent,
      invalidTokens: result.invalidTokens.length,
      truncated: dispatchTruncated,
    };
  } catch (error) {
    console.error("[FCM] Event delivery failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return { attempted: 0, sent: 0, invalidTokens: 0, truncated: false };
  }
}
