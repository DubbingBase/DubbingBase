
import type { ToastOptions } from '@/components/common/AppToastContainer.vue';

class Toast {
  private onDismissResolve: ((data: any) => void) | null = null;
  private onDismissPromise: Promise<any>;

  constructor(private options: any) {
    this.onDismissPromise = new Promise((resolve) => {
      this.onDismissResolve = resolve;
    });
  }

  async present() {
    if (typeof window !== 'undefined' && (window as any).__addToast) {
      const options: ToastOptions = {
        message: this.options.message,
        duration: this.options.duration ?? 2000,
        position: this.options.position || 'bottom',
        color: this.options.color || 'dark'
      };
      
      (window as any).__addToast(options);
      
      if (options.duration !== 0 && this.onDismissResolve) {
        setTimeout(() => {
          if (this.onDismissResolve) this.onDismissResolve({ role: 'timeout' });
        }, options.duration);
      }
    }
  }

  async onDidDismiss() {
    return this.onDismissPromise;
  }
}

export const toastController = {
  async create(options: any) {
    return new Toast(options);
  }
};
