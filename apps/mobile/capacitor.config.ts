import type { CapacitorConfig } from "@capacitor/cli";

const keyAlias = process.env.KEY_ALIAS;
const keyPassword = process.env.KEY_PASSWORD;
const storePassword = process.env.KEYSTORE_PASSWORD;

const buildOptions: NonNullable<CapacitorConfig["android"]>["buildOptions"] =
  {};

// if (process.env.CI) {
buildOptions.keystoreAlias = keyAlias;
buildOptions.keystoreAliasPassword = keyPassword;
buildOptions.keystorePath = "./dubbing-base-keystore.jks"; // generated at runtie by CI using KEYSTORE_FILE;
buildOptions.keystorePassword = storePassword;
// }

console.log("buildOptions", buildOptions);

const config: CapacitorConfig = {
  appId: "com.dubbingbase.app",
  appName: "DubbingBase",
  webDir: "dist",
  plugins: {
    // Configure the App plugin for deep linking
    App: {
      // This is the custom URL scheme your app will respond to
      customUrlScheme: "dubbingbase",
      // This is the universal link domain (for iOS)
      iosScheme: "dubbingbase",
      // This is the app's website domain (for Android App Links)
      androidScheme: "https",
      // This is the host for universal links (for iOS)
      hostname: "dubbingbase.app",
      // This is the path prefix for universal links
      path: "/",
      launchUrl: "dubbingbase://",
    },
  },
  android: {
    buildOptions,
  },
};

export default config;
