import { toast } from 'vue-sonner';

export const toastController = {
  create: async (options: any) => {
    return {
      present: async () => {
        const durationMs = options.duration === "long" ? 3500 : options.duration === "short" ? 2000 : options.duration || 2000;
        if (options.color === 'danger') toast.error(options.message, { duration: durationMs });
        else if (options.color === 'success') toast.success(options.message, { duration: durationMs });
        else if (options.color === 'warning') toast.warning(options.message, { duration: durationMs });
        else toast(options.message, { duration: durationMs });
      },
      onDidDismiss: async () => Promise.resolve()
    };
  }
};

export function useToast() {
  const showToast = async (
    message: string,
    duration: number | "short" | "long" = 2000,
    color: string = "dark",
    position: "top" | "bottom" | "middle" = "bottom"
  ) => {
    const toastDuration = duration === "short" ? 2000 : duration === "long" ? 3500 : duration;
    
    // Note: Sonner positions are standard (e.g. bottom-center)
    // We configured <Toaster position="bottom-center" /> in App.vue globally
    if (color === 'danger') toast.error(message, { duration: toastDuration });
    else if (color === 'success') toast.success(message, { duration: toastDuration });
    else if (color === 'warning') toast.warning(message, { duration: toastDuration });
    else toast(message, { duration: toastDuration });
  };

  return { showToast, toastController };
}
