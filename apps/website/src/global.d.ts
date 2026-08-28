import "@vue/runtime-core";

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $t: (key: string, ...args: any[]) => string;
    $te: (key: string, ...args: any[]) => boolean;
    $tc: (key: string, ...args: any[]) => string;
    $n: (val: number, ...args: any[]) => string;
    $d: (val: Date | number, ...args: any[]) => string;
  }
}

export {};
