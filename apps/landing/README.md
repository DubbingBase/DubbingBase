
## App Links / Universal Links

To finish configuring Deep Links / Universal Links, replace the placeholders in the following files with your actual App identifiers:

1. **iOS (`apps/landing/public/.well-known/apple-app-site-association`)**:
   - Replace `<YOUR_APPLE_TEAM_ID>` with your actual Apple Team ID (e.g., `ABCDE12345`).

2. **Android (`apps/landing/public/.well-known/assetlinks.json`)**:
   - Replace `<YOUR_ANDROID_SHA256_FINGERPRINT>` with your app signing certificates SHA-256 fingerprint (e.g., `14:6D:E9:83:C5:73:06:50:D8:EE:B9:95:2F:34:FC:64:16:A0:83:42:E6:1D:BE:A8:8A:04:96:B2:3F:CF:44:E5`).
