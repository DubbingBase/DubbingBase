
import type { AlertOptions } from '@/components/common/AppAlertContainer.vue';

class Alert {
  private onDismissResolve: ((data: any) => void) | null = null;
  private onDismissPromise: Promise<any>;

  constructor(private options: any) {
    this.onDismissPromise = new Promise((resolve) => {
      this.onDismissResolve = resolve;
    });
  }

  async present() {
    if (typeof window !== 'undefined' && (window as any).__addAlert) {
      const options: AlertOptions = {
        header: this.options.header,
        message: this.options.message,
        inputs: this.options.inputs,
        buttons: this.options.buttons,
        backdropDismiss: this.options.backdropDismiss
      };
      
      (window as any).__addAlert(options, (data: any) => {
        if (this.onDismissResolve) {
          this.onDismissResolve(data);
        }
      });
    } else {
      console.warn('AppAlertContainer not mounted. Fallback to native alert.');
      alert(this.options.message || this.options.header);
      if (this.onDismissResolve) {
        this.onDismissResolve({ role: 'cancel' });
      }
    }
  }

  async onDidDismiss() {
    return this.onDismissPromise;
  }
}

export const alertController = {
  async create(options: any) {
    return new Alert(options);
  }
};
