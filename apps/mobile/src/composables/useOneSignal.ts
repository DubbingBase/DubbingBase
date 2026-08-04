import { isPlatform } from '@ionic/vue';
import OneSignal from '@onesignal/capacitor-plugin';
import { useOneSignal as useOneSignalWeb } from '@onesignal/onesignal-vue3';

let initPromise: Promise<boolean> | null = null;

export function useOneSignal() {
  const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;

  const initOneSignal = () => {
    if (!appId) {
      console.warn('OneSignal skipped: VITE_ONESIGNAL_APP_ID is not defined');
      return Promise.resolve(false);
    }

    if (!initPromise) {
      if (isPlatform('capacitor')) {
        // Native
        initPromise = OneSignal.initialize(appId).then(() => {
          console.log('OneSignal initialized successfully (Native)');
          return true;
        }).catch((error) => {
          console.error("OneSignal initialization failed (Native):", error);
          return false;
        });
      } else {
        // Web
        const OneSignalWebInstance = useOneSignalWeb();
        if (OneSignalWebInstance) {
          // The Vue plugin automatically initializes when we pass {appId} in main.ts
          console.log('OneSignal web SDK loaded via Vue plugin');
          initPromise = Promise.resolve(true);
        } else {
          console.warn("OneSignalWeb instance not found");
          return Promise.resolve(false);
        }
      }
    }
    
    return initPromise;
  };

  const withOneSignal = async <T>(
    nativeAction: () => Promise<T>,
    webAction: () => Promise<T>,
    fallback: T
  ): Promise<T> => {
    if (!appId) return fallback;
    if (!initPromise) initOneSignal();
    
    if (initPromise) {
      const isInitialized = await initPromise;
      if (!isInitialized) {
        console.warn("OneSignal action skipped because initialization failed previously.");
        return fallback;
      }
    }

    try {
      if (isPlatform('capacitor')) {
        return await nativeAction();
      } else {
        return await webAction();
      }
    } catch (error) {
      console.error("OneSignal action failed:", error);
      return fallback;
    }
  };

  const login = (userId: string) =>
    withOneSignal(
      () => OneSignal.login(userId),
      async () => {
        const instance = useOneSignalWeb();
        await instance?.login(userId);
      },
      undefined
    );

  const logout = () =>
    withOneSignal(
      () => OneSignal.logout(),
      async () => {
        const instance = useOneSignalWeb();
        await instance?.logout();
      },
      undefined
    );

  const requestPushPermission = (fallbackToSettings = true) =>
    withOneSignal(
      async () => {
        const success = await OneSignal.Notifications.requestPermission(fallbackToSettings);
        console.log("OneSignal push permission granted: " + success);
        return success;
      },
      async () => {
        const instance = useOneSignalWeb();
        return !!(await instance?.Notifications?.requestPermission());
      },
      false
    );

  const hasPermission = () =>
    withOneSignal(
      () => OneSignal.Notifications.hasPermission(),
      async () => {
        const instance = useOneSignalWeb();
        return !!instance?.Notifications?.permission;
      },
      false
    );

  return {
    initOneSignal,
    login,
    logout,
    requestPushPermission,
    hasPermission
  };
}

