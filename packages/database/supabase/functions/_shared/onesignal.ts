export interface OneSignalOptions {
  targetExternalIds?: string[];
  url?: string;
}

export async function sendOneSignalNotification(
  title: string,
  message: string,
  options?: OneSignalOptions,
) {
  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const apiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
  const adminId = Deno.env.get("ADMIN_USER_ID");

  if (!appId || !apiKey) {
    console.warn("[OneSignal] Credentials missing, skipping notification");
    return;
  }

  // Determine target users
  let targetExternalIds: string[] = [];
  
  if (options?.targetExternalIds && options.targetExternalIds.length > 0) {
    targetExternalIds = options.targetExternalIds;
  } else {
    if (!adminId) {
      console.warn("[OneSignal] ADMIN_USER_ID missing, cannot target admin user. Skipping notification");
      return;
    }
    targetExternalIds = [adminId];
  }

  if (targetExternalIds.length === 0) {
    console.log("[OneSignal] No target external IDs provided, skipping notification.");
    return;
  }

  try {
    const payload: any = {
      app_id: appId,
      target_channel: "push",
      include_aliases: {
        external_id: targetExternalIds,
      },
      headings: { en: title },
      contents: { en: message },
    };

    if (options?.url) {
      payload.app_url = options.url;
    }

    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error("[OneSignal] API error:", res.status, await res.text());
    } else {
      console.log(`[OneSignal] Notification sent successfully to ${targetExternalIds.length} users`);
    }
  } catch (err) {
    console.error("[OneSignal] Fetch exception:", err);
  }
}
