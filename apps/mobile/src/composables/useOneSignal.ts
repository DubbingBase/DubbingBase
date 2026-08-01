import { isPlatform } from '@ionic/vue';
import OneSignal from '@onesignal/capacitor-plugin';

export function useOneSignal() {
  const initOneSignal = () => {
    // Only initialize on native platforms (iOS/Android)
    if (!isPlatform('capacitor')) {
      console.log('OneSignal skipped: Not running in a native environment');
      return;
    }

    const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;

    if (!appId) {
      console.warn('OneSignal skipped: VITE_ONESIGNAL_APP_ID is not defined');
      return;
    }

    // Set OneSignal App ID
    OneSignal.initialize(appId);

    // Request Permission for iOS (Android will prompt automatically in newer versions)
    OneSignal.Notifications.requestPermission(true).then((success: Boolean) => {
      console.log("OneSignal push permission granted: " + success);
    });

    console.log('OneSignal initialized successfully');
  };

  return {
    initOneSignal
  };
}
