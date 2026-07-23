import type { AlertOptions } from "@/components/common/AppAlertContainer.vue";

class Alert {
  private onDismissResolve: ((data: unknown) => void) | null = null;
  private onDismissPromise: Promise<unknown>;

  constructor(private options: AlertOptions) {
    this.onDismissPromise = new Promise((resolve) => {
      this.onDismissResolve = resolve;
    });
  }

  async present() {
    if (typeof window !== "undefined" && (window as unknown as { __addAlert: (opts: AlertOptions, callback: (data: unknown) => void) => void }).__addAlert) {
      const options: AlertOptions = {
        header: this.options.header,
        message: this.options.message,
        inputs: this.options.inputs,
        buttons: this.options.buttons,
        backdropDismiss: this.options.backdropDismiss,
      };

      (window as unknown as { __addAlert: (opts: AlertOptions, callback: (data: unknown) => void) => void }).__addAlert(options, (data: unknown) => {
        if (this.onDismissResolve) {
          this.onDismissResolve(data);
        }
      });
    } else {
      console.warn("AppAlertContainer not mounted. Fallback to native alert.");
      alert(this.options.message || this.options.header);
      if (this.onDismissResolve) {
        this.onDismissResolve({ role: "cancel" });
      }
    }
  }

  async onDidDismiss() {
    return this.onDismissPromise;
  }
}

export const alertController = {
  async create(options: AlertOptions) {
    return new Alert(options);
  },
};
