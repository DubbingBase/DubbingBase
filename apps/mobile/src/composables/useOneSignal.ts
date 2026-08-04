import { isPlatform } from '@ionic/vue';
import OneSignal from '@onesignal/capacitor-plugin';
import { useOneSignal as useOneSignalWeb } from '@onesignal/onesignal-vue3';

let initPromise: Promise<void> | null = null;

export function useOneSignal() {
  const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;

  const initOneSignal = () => {
    if (!appId) {
      console.warn('OneSignal skipped: VITE_ONESIGNAL_APP_ID is not defined');
      return Promise.resolve();
    }

    if (!initPromise) {
      if (isPlatform('capacitor')) {
        // Native
        initPromise = OneSignal.initialize(appId).then(() => {
          console.log('OneSignal initialized successfully (Native)');
        }).catch((error) => {
          console.error("OneSignal initialization failed (Native):", error);
        });
      } else {
        // Web
        const OneSignalWebInstance = useOneSignalWeb();
        if (OneSignalWebInstance) {
          // The Vue plugin automatically initializes when we pass {appId} in main.ts
          console.log('OneSignal web SDK loaded via Vue plugin');
          initPromise = Promise.resolve();
        } else {
          console.warn("OneSignalWeb instance not found");
          return Promise.resolve();
        }
      }
    }
    
    return initPromise;
  };

  const login = async (userId: string) => {
    if (!appId) return;
    if (initPromise) await initPromise;
    try {
      if (isPlatform('capacitor')) {
        await OneSignal.login(userId);
      } else {
        const OneSignalWebInstance = useOneSignalWeb();
        await OneSignalWebInstance?.login(userId);
      }
    } catch (error) {
      console.error("OneSignal login failed:", error);
    }
  };

  const logout = async () => {
    if (!appId) return;
    if (initPromise) await initPromise;
    try {
      if (isPlatform('capacitor')) {
        await OneSignal.logout();
      } else {
        const OneSignalWebInstance = useOneSignalWeb();
        await OneSignalWebInstance?.logout();
      }
    } catch (error) {
      console.error("OneSignal logout failed:", error);
    }
  };

  const requestPushPermission = async (fallbackToSettings = true) => {
    if (!appId) return false;
    try {
      if (initPromise) await initPromise;
      if (isPlatform('capacitor')) {
        const success = await OneSignal.Notifications.requestPermission(fallbackToSettings);
        console.log("OneSignal push permission granted: " + success);
        return success;
      } else {
        const OneSignalWebInstance = useOneSignalWeb();
        const success = await OneSignalWebInstance?.Notifications?.requestPermission();
        return !!success;
      }
    } catch (error) {
      console.error("OneSignal permission request failed:", error);
      return false;
    }
  };

  const hasPermission = async () => {
    if (!appId) return false;
    if (initPromise) await initPromise;
    if (isPlatform('capacitor')) {
      return await OneSignal.Notifications.hasPermission();
    } else {
      const OneSignalWebInstance = useOneSignalWeb();
      return !!OneSignalWebInstance?.Notifications?.permission;
    }
  };

  return {
    initOneSignal,
    login,
    logout,
    requestPushPermission,
    hasPermission
  };
}

