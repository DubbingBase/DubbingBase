export async function sendOneSignalNotification(title: string, message: string) {
  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const apiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");
  const adminId = Deno.env.get("ADMIN_USER_ID");

  if (!appId || !apiKey) {
    console.warn("[OneSignal] Credentials missing, skipping notification");
    return;
  }

  if (!adminId) {
    console.warn("[OneSignal] ADMIN_USER_ID missing, cannot target admin user. Skipping notification");
    return;
  }

  try {
    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${apiKey}`,
      },
      body: JSON.stringify({
        app_id: appId,
        target_channel: "push",
        include_aliases: {
          external_id: [adminId]
        },
        headings: { en: title },
        contents: { en: message },
      }),
    });

    if (!res.ok) {
      console.error("[OneSignal] API error:", res.status, await res.text());
    } else {
      console.log("[OneSignal] Notification sent successfully");
    }
  } catch (err) {
    console.error("[OneSignal] Fetch exception:", err);
  }
}
