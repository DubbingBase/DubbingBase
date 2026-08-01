import { isPlatform } from '@ionic/vue';
import OneSignal from '@onesignal/capacitor-plugin';

export function useOneSignal() {
  const initOneSignal = async () => {
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

    try {
      // Set OneSignal App ID
      OneSignal.initialize(appId);

      // Do not prompt automatically on startup per review comment.
      const success = await OneSignal.Notifications.requestPermission(false);
      console.log("OneSignal push permission granted: " + success);

      console.log('OneSignal initialized successfully');
    } catch (error) {
      console.error("OneSignal initialization or permission request failed:", error);
    }
  };

  return {
    initOneSignal
  };
}
