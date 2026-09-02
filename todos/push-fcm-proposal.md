# Push Notifications: OneSignal → FCM Migration Proposal

> State-of-the-art. Reviewed end-to-end. One open question at the end (mobile build target).
> **Ponytail applied:** minimum surface, stdlib over libraries, single source of truth for tokens, no premature abstraction.

---

## 0. TL;DR (Review Checkpoint #1)

- **Tokens live in our DB, keyed by `(user_id, fcm_token)`.** The server is the only place that knows the user→device map. This is the modern pattern (FCM HTTP v1 + per-user topic fanout is deprecated; direct token addressing is the current Google guidance).
- **One server function, one client composable, one DB table.** No device/notification-prefs UI is added (not requested, not built).
- **No new dependencies** for the server: `fetch` + a tiny Google Auth helper beats a 200 kB SDK on Cloudflare Workers. Web client uses official `firebase` modular SDK (tree-shakable). Native uses `@capacitor/push-notifications` (already in the Capacitor ecosystem) — *not* `@capacitor-community/firebase-push` (unmaintained).
- **Anonymous sign-ins are disabled** (`config.toml:144`); "connected account" = `auth.users.id`. The `is_anonymous` code path in `auth.ts:175` is dead but kept safe.
- **Deeplinks preserved** exactly: web click → `additionalData.path`; native click → FCM `data.path`. Universal Links / App Links already configured in `UNIVERSAL_LINKS.md`.

---

---

## 2. Database model

**Review Checkpoint #2 — read this section carefully. It's the source of truth.**

### 2.1 New table: `fcm_tokens`

```sql
-- packages/database/supabase/migrations/20260902000000_fcm_tokens.sql

create type public.push_platform as enum ('ios', 'android', 'web');

create table public.fcm_tokens (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references auth.users(id) on delete cascade,
  fcm_token   text        not null,
  platform    public.push_platform not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  constraint fcm_tokens_token_unique unique (fcm_token)
);

create index fcm_tokens_user_id_idx on public.fcm_tokens (user_id);

-- RLS: a user can only see/manage their own tokens.
alter table public.fcm_tokens enable row level security;

create policy "Users read own tokens"
  on public.fcm_tokens for select
  using (auth.uid() = user_id);

create policy "Users insert own tokens"
  on public.fcm_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users update own tokens"
  on public.fcm_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own tokens"
  on public.fcm_tokens for delete
  using (auth.uid() = user_id);

-- The server uses the service-role key (bypasses RLS) for fan-out lookups.
```

**Design notes:**
- `fcm_token` is globally unique (a token belongs to one device, which belongs to one user; FCM rotates tokens server-side on app reinstall, so the *same* user on a *new* device gets a *new* token — but a single token must never be shared across users). Unique constraint catches that misconfiguration.
- `last_seen_at` is bumped on every successful send (server side). No nightly sweep needed: FCM tells us about `UNREGISTERED` tokens in the send response, we delete those rows there.
- No `is_active` boolean: presence in the table = active. Soft-delete not worth it; if a user re-installs, the token is different.

### 2.2 No changes to existing tables

- `voice_actor_subscriptions` stays exactly as-is. It already drives fan-out targets. Server resolves `(user_id) → fcm_tokens` at send time.
- `user_profiles` stays. No `notification_prefs` table (not in scope).

---

## 3. Server: sending notifications

### 3.1 FCM HTTP v1 auth

**Ponytail: no library added.** Try `jose` (if already in `package.json`, use `new SignJWT`). Fall back to the Web Crypto JWT-bearer below. If neither is available, the migration is blocked on that dep — `google-auth-library` doesn't work on Cloudflare Workers.

`apps/website/server/utils/notifications/fcm.ts` (replaces `onesignal.ts`):

```ts
// One access token per process, cached until ~5 min before expiry.
let cached: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cached && cached.exp - Date.now() > 5 * 60_000) return cached.token;

  const cfg = useRuntimeConfig();
  const { fcmClientEmail, fcmPrivateKey } = cfg;
  if (!fcmClientEmail || !fcmPrivateKey) {
    throw new Error("[FCM] Service account env vars missing");
  }

  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({ scope: "https://www.googleapis.com/auth/firebase.messaging" })
    .setIssuer(fcmClientEmail)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt({ integer: true })
    .setExpirationTime({ integer: true, seconds: 3600 })
    .setProtectedHeader({ alg: "RS256" })
    .sign(createSecretKey(pemToArrayBuffer(fcmPrivateKey), "pkcs8"));

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`[FCM] Token exchange failed: ${res.status}`);
  const { access_token, expires_in } = await res.json();
  cached = { token: access_token, exp: Date.now() + expires_in * 1000 };
  return access_token;
}
```

`pemToArrayBuffer` is a 5-line helper. `createSecretKey` is Node built-in.

### 3.2 Send function

Same signature as the OneSignal one — `notify-subscribers.post.ts` doesn't change.

```ts
export interface FcmOptions {
  userIds: string[];                          // replaces targetExternalIds
  url?: string;
  data?: Record<string, unknown>;
  imageUrl?: string;
  title?: string;                             // already passed as 1st arg in our case
}

export async function sendFcmNotification(
  title: string, message: string, options: FcmOptions,
): Promise<{ sent: number; pruned: number }> {
  const cfg = useRuntimeConfig();
  if (!options.userIds.length) return { sent: 0, pruned: 0 };

  const admin = useSupabaseAdmin();

  // 1. Resolve users → tokens in one query.
  const { data: rows, error } = await admin
    .from("fcm_tokens")
    .select("id, fcm_token, user_id, platform")
    .in("user_id", options.userIds);
  if (error) throw error;

  if (!rows?.length) return { sent: 0, pruned: 0 };

  // 2. FCM HTTP v1 caps at 500 tokens/request AND requires same-platform per call
  //    (web push uses FCM web endpoint, native uses APNs/FCM endpoint).
  const buckets = { web: [], native: [] } as Record<
    "web" | "native", { id: number; token: string; userId: string }[]
  >;
  for (const r of rows) {
    buckets[r.platform === "web" ? "web" : "native"].push(r);
  }

  // 3. FCM caps at 500 tokens/request. Chunk.
  const results = { sent: 0, pruned: 0 };
  for (const [platform, items] of Object.entries(buckets)) {
    for (let i = 0; i < items.length; i += 500) {
      const chunk = items.slice(i, i + 500);
      const res = await sendChunk(platform, chunk, title, message, options);
      results.sent += res.sent;
      results.pruned += res.pruned;
    }
  }
  return results;
}
```

`sendChunk` builds the FCM v1 payload, POSTs `https://fcm.googleapis.com/v1/projects/{id}/messages:send` with `validate_only: false`, and inspects the per-token response. FCM returns per-token `error.code: UNREGISTERED | INVALID_ARGUMENT`; on those we **delete the token row** server-side (the "pruned" count). That's how the system heals itself — no separate sweep needed for "this user uninstalled" (we get told).

```ts
// Inside sendChunk — response handling (pseudo):
type fcmResp = { results: { messageId?: string; error?: { code: string } }[] };
const json: fcmResp = await res.json();
const dead: number[] = [];
json.results.forEach((r, idx) => {
  if (r.messageId) sent++;
  else if (r.error?.code === "UNREGISTERED" ||
           r.error?.code === "INVALID_ARGUMENT") dead.push(items[idx].id);
});
if (dead.length) {
  await admin.from("fcm_tokens").delete().in("id", dead);
  pruned += dead.length;
}
```

**Ponytail: no retry queue.** FCM's 5xx → throw (Cloudflare will retry on a 5xx return, which the endpoint above should return to make the Supabase webhook retry once). Per-token 4xx → delete the row. Don't add a Dead Letter Queue yet.

### 3.3 Updated notify-subscribers endpoint

One line changes — `sendOneSignalNotification` → `sendFcmNotification` + `targetExternalIds` → `userIds`. Body identical.

```ts
await sendFcmNotification(
  `New Role for ${voiceActorName}`,
  `They have just been added to the cast of ${mediaTitle}!`,
  {
    userIds: targetUserIds,            // was: targetExternalIds
    url: `/voice-actor/${voiceActorId}`,
    imageUrl,
  },
);
```

URL translation (web_url/app_url split) **moves into `sendFcmNotification`** because FCM puts the URL inside `notification.click_action` (Android) or relies on a `data` payload (iOS, web) — it doesn't have OneSignal's automatic `web_url`/`app_url` duality. We keep the same `dubbingbase://*<path>` convention so the existing `handleDeepLink` path works.

```ts
// FCM payload data (all platforms read this):
{
  notification: { title, body, image: imageUrl },
  data: {
    path: options.url,                              // /voice-actor/42
    url:  isAbsolute(options.url) ? options.url
                                  : `https://dubbingbase.com/fr${options.url}`,
    deepLink: `dubbingbase://*${options.url}`,      // legacy alias
    ...options.data,
  },
  // Android-specific: explicit click action so the OS launches the right intent
  android: { notification: { click_action: "OPEN_ACTIVITY" } },
  // iOS: we want the default tap-to-open behaviour; no apns.payload, just data
  webpush: { fcm_options: { link: /* web URL */ } },
}
```

### 3.4 Webhook auth (existing)

`notify-subscribers.post.ts` has no auth. The Supabase DB webhook secret is in the URL. **Keep as-is.** We don't need to harden it as part of this migration. (`Ponytail: YAGNI hardening.`)

---

## 4. Client: token registration (the heart of the migration)

**Review Checkpoint #3.** The trickiest piece. Three platforms, each with different SDKs, all converging on the same Supabase table.

### 4.1 Shared composable (mobile + website-as-PWA)

`apps/mobile/src/composables/useFcm.ts` (replaces `useOneSignal.ts`):

```ts
import { isPlatform } from "@ionic/vue";
import { PushNotifications } from "@capacitor/push-notifications";
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, deleteToken }
  from "firebase/messaging";

let initPromise: Promise<boolean> | null = null;
let messaging: ReturnType<typeof getMessaging> | null = null;

export function useFcm() {
  const isCapacitor = isPlatform("capacitor");
  const isIos       = isPlatform("ios");

  const cfg = {
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
    vapidKey:          import.meta.env.VITE_FIREBASE_VAPID_KEY,
  };

  async function initFcm() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      if (isCapacitor) {
        await PushNotifications.requestPermissions();
        await PushNotifications.register();
        return true;
      }
      messaging = getMessaging(initializeApp(cfg));
      onTokenRefresh(messaging, () => persistTokenToServer(getToken(messaging!, { vapidKey: cfg.vapidKey })));
      return true;
    })();
    return initPromise;
  }

  async function getCurrentToken(): Promise<string | null> {
    if (isPlatform("capacitor")) {
      return new Promise((resolve) => {
        const sub = PushNotifications.addListener("registration",
          (t) => { sub.remove(); resolve(t.value); });
        setTimeout(() => { sub.remove(); resolve(null); }, 10_000);
      });
    }
    if (!messaging) return null;
    return getToken(messaging, { vapidKey: cfg.vapidKey });
  }

  async function persistTokenToServer(token: string) {
    // The user_id is implicit: server reads it from the auth.uid() JWT.
    // We use supabase-js with the user's session, not service-role.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;            // not signed in yet — caller will retry
    const platform = isCapacitor ? (isIos ? "ios" : "android") : "web";
    const { error } = await supabase.from("fcm_tokens").upsert(
      { user_id: user.id, fcm_token: token, platform,
        user_agent: navigator.userAgent, last_seen_at: new Date().toISOString() },
      { onConflict: "fcm_token" },   // global unique on token
    );
    if (error) console.error("[FCM] persist failed", error);
  }

  async function loginAndRegister() {
    await initFcm();
    const token = await getCurrentToken();
    if (token) await persistTokenToServer(token);
  }

  async function logoutAndUnregister() {
    const token = await getCurrentToken();
    if (token) {
      await supabase.from("fcm_tokens").delete().eq("fcm_token", token);
    }
    if (!isCapacitor && messaging) {
      await deleteToken(messaging);
    }
  }

  return { initFcm, loginAndRegister, logoutAndUnregister };
}
```

**Multi-device is handled by the `(user_id, fcm_token)` row model.** A user with phone + laptop + work-desktop has 3 rows. Server fan-out hits all 3. Same token on two devices is impossible (constraint + FCM-issued tokens are device-scoped).

**New-device registration is automatic** via the `auth.ts` listener: on `SIGNED_IN`, call `loginAndRegister()`. If the device already has a token, `upsert` is a no-op (matched on `fcm_token` unique). If it's a new device, new row. FCM itself rotates tokens on app reinstall, so a "new install" looks like a new token to us.

### 4.2 Wiring into `auth.ts` (mobile)

```ts
// replace `import { useOneSignal } from "@/composables/useOneSignal"`
import { useFcm } from "@/composables/useFcm";

// In initialize():
const { loginAndRegister, logoutAndUnregister } = useFcm();
if (session?.user) {
  user.value = session.user;
  loginAndRegister().catch(console.error);
}

// In onAuthStateChange:
if (session?.user) {
  loginAndRegister().catch(console.error);
  posthog.identify(session.user.id);
} else if (event === "SIGNED_OUT" || !session) {
  logoutAndUnregister().catch(console.error);
  posthog.reset();
}
```

**Edge case: not-signed-in user opens the app.** `persistTokenToServer` early-returns if `supabase.auth.getUser()` is null; `loginAndRegister` then no-ops the server write (the SDK still initializes locally, which is fine).

**Edge case: token rotates while user is signed in.** `onTokenRefresh` listener is registered in `initFcm` (web path) and re-runs `persistTokenToServer` automatically.

### 4.3 Service worker (web only)

`apps/mobile/public/firebase-messaging-sw.js` (replaces `OneSignalSDKWorker.js`):

```js
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:            self.__FIREBASE_API_KEY__,
  authDomain:        self.__FIREBASE_AUTH_DOMAIN__,
  projectId:         self.__FIREBASE_PROJECT_ID__,
  messagingSenderId: self.__FIREBASE_SENDER_ID__,
  appId:             self.__FIREBASE_APP_ID__,
});
const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon:  payload.notification.image,
    data:  payload.data,                                // { path, url, ... }
  });
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const path = e.notification.data?.path;
  e.waitUntil(clients.matchAll({ type: "window" }).then((wins) => {
    const target = path
      ? (path.startsWith("http") ? path : `https://dubbingbase.com/fr${path}`)
      : "https://dubbingbase.com";
    return wins[0] ? wins[0].focus() : clients.openWindow(target);
  }));
});
```

Vite env injection via a build step (or hard-code the public values — they're already public). **Ponytail:** hard-code, add a comment that they're public.

## 4.4 `main.ts` (mobile web)

```ts
// remove
// import OneSignalVuePlugin from "@onesignal/onesignal-vue3";
// app.use(OneSignalVuePlugin, { appId: ... });

// add
import { useFcm } from "@/composables/useFcm";
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/firebase-messaging-sw.js");
}
```

Native path needs `apps/mobile/android/app/google-services.json` and an iOS `GoogleService-Info.plist` from the Firebase console. **Ponytail:** these are config files, not code. They go in the repo with a comment "do not commit API keys" (they're not secret anyway — they identify the project, not authenticate it).

## 4.5 Capacitor plugin: native push

`@capacitor/push-notifications` returns the FCM token directly on Android. On iOS it returns the APNs token, which we still feed into FCM (FCM wraps APNs). Both go in `fcm_tokens.fcm_token` — the value FCM gave us. **No separate iOS path needed in the server.** We just label the platform.

## 4.6 Caller: `useVoiceActorSubscription`

`apps/mobile/src/composables/useVoiceActorSubscription.ts` — replace:

```diff
- import { useOneSignal } from "@/composables/useOneSignal";
- const { requestPushPermission } = useOneSignal();
- requestPushPermission(true);
+ import { useFcm } from "@/composables/useFcm";
+ useFcm().loginAndRegister();
```

The `manage-subscription` DB call is unchanged.

---

## 5. "Notification only for connected accounts" — enforcement

Two layers, defence in depth:

1. **Client side:** `persistTokenToServer` is a no-op if `supabase.auth.getUser()` returns null. Anonymous visitors never get a token in the DB.
2. **Server side:** `fcm_tokens` RLS makes it impossible to insert a row for someone else's `user_id` (or for an unauthenticated request — the `auth.uid()` JWT claim is required by RLS).
3. **Fan-out side:** `voice_actor_subscriptions` only contains rows for `user_id` of real auth users (it's `references auth.users(id)`). If a user deletes their account, the cascade drops their subscriptions, and fan-out has no targets. The dead `fcm_tokens` rows also cascade.

**Ponytail: do NOT add a "notification_enabled" boolean on `user_profiles`.** Not requested. OS-level permission is the off-switch.

---

## 6. Multi-device scenarios, walked through

| Scenario | What happens | Outcome |
|---|---|---|
| **Desktop only, signed in** | Web SDK requests permission on first sign-in → `fcm_tokens` row `(user_id, web-token, web)` | Web push works |
| **Mobile only, signed in** | Capacitor plugin registers → `fcm_tokens` row `(user_id, fcm-token, ios/android)` | Mobile push works |
| **Both, signed in** | Two rows, one per device | Both receive |
| **Both, signs out on one** | `logoutAndUnregister` deletes by `fcm_token` (not `user_id`) — only this device's row | Correct |
| **Token rotates silently (FCM-side)** | `onTokenRefresh` listener re-persists | Handled |
| **User uninstalls app** | Next send returns `UNREGISTERED` | Token row auto-deleted |
| **User changes account (sign out, sign in as other)** | Old account's tokens for this device deleted; new account's upsert inserts a row | Clean handoff |
| **Two users, same device, sequential** | Sign out → delete this device's token; sign in → upsert under new user. Old user's other devices unaffected. | Correct |
| **Two users, same device, concurrent** | Not possible on a single device with a single browser profile. | OK |

**Ponytail: still no UI** to "list my devices" / "revoke phone". Not requested. The endpoint is in RLS; adding a settings page is a future task.

---

## 7. Deeplink continuity

Existing `useOneSignal.ts` reads `additionalData.path` / `additionalData.url` / `launchURL`. FCM equivalent:

| Platform | FCM data field | Maps to |
|---|---|---|
| Web (SW) | `e.notification.data.path` | URL in handler |
| Web (foreground) | `payload.data.path` | routed in app code |
| iOS | `userInfo.path` (we set it in `apns.payload.data`) | native click handler |
| Android | `data.path` + `notification.click_action` (we set `OPEN_ACTIVITY`) | MainActivity intent extras |

`handleDeepLink()` from `apps/mobile/src/utils/deepLinks.ts` is unchanged. **Ponytail:** don't re-export; keep using the same util.

---

## 8. Files to change (final list)

**Remove:**
- `apps/mobile/src/composables/useOneSignal.ts`
- `apps/mobile/public/OneSignalSDKWorker.js`
- `patches/@onesignal__capacitor-plugin.patch`

**Create:**
- `apps/mobile/src/composables/useFcm.ts`
- `apps/mobile/public/firebase-messaging-sw.js`
- `apps/website/server/utils/notifications/fcm.ts`
- `packages/database/supabase/migrations/20260902000000_fcm_tokens.sql`
- (optional) `apps/mobile/android/app/google-services.json`, `apps/mobile/ios/App/GoogleService-Info.plist`

**Modify:**
- `apps/mobile/src/main.ts` — drop OneSignal plugin, register SW
- `apps/mobile/src/stores/auth.ts` — swap `useOneSignal` → `useFcm`
- `apps/mobile/src/composables/useVoiceActorSubscription.ts` — swap import
- `apps/mobile/vite.config.ts` — drop OneSignal env
- `apps/mobile/package.json` — swap deps
- `apps/mobile/android/capacitor.settings.gradle` — drop OneSignal module
- `apps/website/server/api/notify-subscribers.post.ts` — swap call
- `apps/website/nuxt.config.ts` — drop OneSignal runtimeConfig, add FCM
- `.env.example` — replace vars
- `.github/workflows/pipeline.yml` — replace secrets
- `pnpm-workspace.yaml`, root `package.json` — drop patch
- `packages/database/src/database.types.ts` — regenerate

**Untouched:**
- `voice_actor_subscriptions` schema
- `manage-subscription.post.ts`
- `handleDeepLink` util
- All voice-actor UI / settings / profile views
- All auth middleware

---

## 9. Configuration surface

`.env.example`:
```
# Firebase / FCM
NUXT_FCM_PROJECT_ID=
NUXT_FCM_CLIENT_EMAIL=                  # service account
NUXT_FCM_PRIVATE_KEY=                   # PEM, newlines as \n

# Mobile (Vite)
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=                # web only
```

`nuxt.config.ts`:
```ts
runtimeConfig: {
  fcmProjectId:   process.env.NUXT_FCM_PROJECT_ID,
  fcmClientEmail: process.env.NUXT_FCM_CLIENT_EMAIL,
  fcmPrivateKey:  process.env.NUXT_FCM_PRIVATE_KEY,   // multi-line, .env handles \n
  // ... existing keys
}
```

**Ponytail: no secrets manager abstraction.** Nitro + `useRuntimeConfig` + env vars is already what the OneSignal keys used. Don't add a vault wrapper.

---

## 10. Rollout & risks

| Risk | Mitigation |
|---|---|
| Tokens delivered to wrong user (constraint violation caught) | DB unique constraint on `fcm_token` |
| Token rotation breaks delivery silently | `onTokenRefresh` listener in `initFcm` |
| Stale tokens from uninstalled apps | FCM returns `UNREGISTERED` → server deletes row |
| JWT-bearer clock skew on Workers | We mint with `exp = now + 3600`, accept 5-min skew; cached for ~55 min |
| FCM down → send throws → webhook retries | Return 5xx; Supabase DB webhook retries on 5xx |
| `fcm_tokens` table missing RLS policies | Migration is atomic; production deploy via `supabase db push` |
| Existing OneSignal users keep getting old notifications during cutover | Cutover is server-side: change `notify-subscribers.post.ts` import. Old OneSignal keys can stay in env for one release then be removed. |

**Cutover order** (no big-bang):
1. Add migration → DB has empty `fcm_tokens` table.
2. Ship client with FCM; OneSignal still active server-side.
3. Users sign in → FCM tokens populate over a few days.
4. Flip `notify-subscribers.post.ts` to FCM.
5. Remove OneSignal deps, env, configs.

---

## 11. What I deliberately did NOT do

- **No notification preferences UI** (mute, per-type). Not requested. `voice_actor_subscriptions` is the only opt-in primitive today; a future "Settings → Notifications" page is a separate feature.
- **No FCM topics.** We don't need them — fan-out is always a closed set of user_ids per call, resolved to tokens at send time. Topics add a layer we'd never query.
- **No Dead-Letter Queue.** Add when a real failure is reported.
- **No multi-tenant or org-level targeting.** One project, one app.
- **No `google-auth-library` dep.** Prefer `jose` if already in `package.json`, else Web Crypto. Neither adds significant bundle weight for this one call.
- **No Edge Function for token registration.** The client writes directly to `fcm_tokens` via RLS. Saves a round-trip. If we ever need server-side token validation, add the function then.

---

## 12. Open question

**The mobile app's exact target platforms** (Capacitor → iOS bundle id, Android package name, FCM project) need to be created in the Firebase console before this ships. I assumed `com.dubbingbase.app` (matches `UNIVERSAL_LINKS.md`). Confirm before generating `google-services.json` / `GoogleService-Info.plist`.

---

**End of proposal. Three review checkpoints above; one open question. Ready to implement on approval.**
