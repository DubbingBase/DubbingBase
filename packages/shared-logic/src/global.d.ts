declare global {
  function $fetch<T = any>(request: string, opts?: any): Promise<T>;
}

export {};
