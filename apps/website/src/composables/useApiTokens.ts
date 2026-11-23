import { API_SCOPES, type ApiScope } from "#shared/api-scopes";

export interface ApiTokenRecord {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

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
