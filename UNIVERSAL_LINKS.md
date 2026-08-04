# Deep Linking & Universal Links Configuration

To enable deep linking from the web (`dubbingbase.com`) directly into the DubbingBase mobile app (`com.dubbingbase.app`), you must configure both Apple Universal Links (for iOS) and Android App Links (for Android). These require files to be hosted on your production server.

## 1. Apple Universal Links (iOS)

Create a file named `apple-app-site-association` (no extension) and host it at the root of `dubbingbase.com` or in the `.well-known` directory (e.g. `https://dubbingbase.com/.well-known/apple-app-site-association`).

### File Contents

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "<TEAM_ID>.com.dubbingbase.app",
        "paths": ["*"]
      }
    ]
  }
}
```

**Required Action:** Replace `<TEAM_ID>` with your actual Apple Developer Team ID.

## 2. Android App Links (Android)

Create a file named `assetlinks.json` and host it in the `.well-known` directory (e.g. `https://dubbingbase.com/.well-known/assetlinks.json`).

### File Contents

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.dubbingbase.app",
      "sha256_cert_fingerprints": ["<YOUR_APP_SHA256_CERTIFICATE_FINGERPRINT>"]
    }
  }
]
```

**Required Action:** Replace `<YOUR_APP_SHA256_CERTIFICATE_FINGERPRINT>` with the SHA256 fingerprint from your Android keystore (the one used to sign your production APK/AAB).

## 3. Capacitor Configuration

The app is already configured for these domains in `apps/mobile/capacitor.config.ts`.

- iOS Hostname: `dubbingbase.com`
- Custom URL Scheme fallback: `dubbingbase://`
