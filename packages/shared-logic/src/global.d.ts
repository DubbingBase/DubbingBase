// Nuxt auto-imports `$fetch` at runtime, and the website gets the real (typed-routes) declaration
// from Nuxt. This package is also typechecked on its own (`pnpm typecheck`, without Nuxt's
// generated types), where the composables' `$fetch` calls would otherwise not resolve.
declare global {
  function $fetch<T = unknown>(request: string, opts?: Record<string, unknown>): Promise<T>;
}

export {};
