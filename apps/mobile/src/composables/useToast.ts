import { Toast } from "@capacitor/toast";

export const toastController = {
  async create(options: any) {
    return {
      async present() {
        await Toast.show({
          text: options.message,
          duration:
            options.duration === 3000 || options.duration === "long"
              ? "long"
              : "short",
          position: options.position || "bottom",
        });
      },
      async onDidDismiss() {
        return Promise.resolve(); // Capacitor Toast doesn't natively return a promise for dismiss
      },
    };
  },
};

export function useToast() {
  const showToast = async (
    message: string,
    duration: number | "short" | "long" = 2000,
    color: string = "dark",
    position: any = "bottom",
  ) => {
    await Toast.show({
      text: message,
      duration: duration === 3000 || duration === "long" ? "long" : "short",
      position: position,
    });
  };

  return { showToast, toastController };
}
