/// <reference types="vite/client" />

declare global {
  function $fetch<T = any>(request: string, opts?: any): Promise<T>;
}

export {};
