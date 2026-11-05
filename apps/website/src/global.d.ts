import "@vue/runtime-core";

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $t: (key: string, ...args: unknown[]) => string;
    $te: (key: string, ...args: unknown[]) => boolean;
    $tc: (key: string, ...args: unknown[]) => string;
    $n: (val: number, ...args: unknown[]) => string;
    $d: (val: Date | number, ...args: unknown[]) => string;
  }
}

export {};
