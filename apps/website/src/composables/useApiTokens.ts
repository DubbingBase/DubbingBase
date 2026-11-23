import { API_SCOPES, type ApiScope } from "#shared/api-scopes";
import type { ApiTokenRecord } from "#shared/api-tokens";

export type { ApiTokenRecord };

export interface CreatedApiToken {
  token: string;
  record: ApiTokenRecord;
}

export interface CreateApiTokenInput {
  name: string;
  scopes: ApiScope[];
  expires_in_days?: number;
}

/** Admin token management (profile → API Key); the routes accept the signed-in session, never an API token. */
export function useApiTokens() {
  const listTokens = () => $fetch<{ tokens: ApiTokenRecord[] }>("/api/tokens");
  const createToken = (input: CreateApiTokenInput) =>
    $fetch<CreatedApiToken>("/api/tokens", { method: "POST", body: input });
  const revokeToken = (id: string) =>
    $fetch<{ revoked: boolean }>(`/api/tokens/${id}`, { method: "DELETE" });
  return { scopes: API_SCOPES, listTokens, createToken, revokeToken };
}
