import type { Tables } from "@app/shared-logic";

/**
 * The api_tokens columns the website may show. Derived from the generated row type, so the
 * list can only name real columns, and the token routes must select exactly these (the token
 * hash is deliberately absent).
 */
export type ApiTokenRecord = Pick<
  Tables<"api_tokens">,
  "id" | "name" | "prefix" | "scopes" | "expires_at" | "last_used_at" | "revoked_at" | "created_at"
>;
