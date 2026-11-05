declare global {
  function $fetch<T = unknown>(request: string, opts?: Record<string, unknown>): Promise<T>;
}

export {};
