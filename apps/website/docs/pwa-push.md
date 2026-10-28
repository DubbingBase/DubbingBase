# Voice actor push notifications

Website push uses Firebase Cloud Messaging for installed Android PWAs and iOS 16.4+ Home Screen PWAs. Permission is requested only after the user follows a voice actor and chooses the enable action, or from the push setting in their account. Desktop browsers and regular iOS Safari do not register installations.

Configure these names in the website Doppler config:

- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` are server-only FCM HTTP v1 credentials. Keep the private key in Doppler/runtime secrets.
- `FIREBASE_API_KEY`, `FIREBASE_APP_ID`, and `FIREBASE_MESSAGING_SENDER_ID` are the Firebase web app configuration embedded in the website and service worker.
- `FIREBASE_VAPID_KEY` is the public Web Push key passed to Firebase Messaging.

FCM is best-effort. Publication transactions commit before sending; a provider or network failure never rolls them back. There is no durable outbox or notification history, so delivery is not guaranteed and a cross-request retry can send a duplicate. Each dispatch is bounded to 500 eligible installations and retries temporary provider failures once. Only FCM `UNREGISTERED` tokens are removed.

`push_installations` stores delivery addresses only, and `user_profiles.push_enabled` is the account-wide delivery toggle. The existing `voice_actor_subscriptions` table remains the sole recipient source. Unfollowing prevents future targeting; it does not create or delete notification records because no inbox exists.
