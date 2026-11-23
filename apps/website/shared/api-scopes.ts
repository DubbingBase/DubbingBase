/**
 * Permissions a public API token can carry, written `resource:action`. The `api_tokens.scopes`
 * check constraint accepts the same list, so adding a scope needs a migration as well.
 */
export const API_SCOPES = ["voice-actors:read", "voice-actors:write"] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export function isApiScope(value: unknown): value is ApiScope {
  return API_SCOPES.some((scope) => scope === value);
}
