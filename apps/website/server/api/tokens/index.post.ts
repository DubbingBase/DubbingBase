import * as v from "valibot";
import { API_SCOPES } from "../../../shared/api-scopes";
import { defineAdminHandler } from "../../utils/auth-handlers";
import { useSupabaseAdmin } from "../../utils/db/client";
import { generateApiToken } from "../../utils/api-v1/tokens";

const MAX_ACTIVE_TOKENS = 20;
const MAX_EXPIRY_DAYS = 365;

const CreateToken = v.strictObject({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80)),
  scopes: v.pipe(v.array(v.picklist(API_SCOPES)), v.minLength(1)),
  /** Days until the token expires; omit for a token that never expires. */
  expires_in_days: v.optional(
    v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(MAX_EXPIRY_DAYS)),
  ),
});

/** Creates a token. The plaintext is returned once and cannot be retrieved again. */
export default defineAdminHandler(async (event, admin) => {
  const parsed = v.safeParse(CreateToken, await readBody(event));
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: "Invalid API token request" });
  }
  const { name, scopes, expires_in_days } = parsed.output;
  const supabase = useSupabaseAdmin(event);

  const { count } = await supabase
    .from("api_tokens")
    .select("id", { count: "exact", head: true })
    .eq("user_id", admin.id)
    .is("revoked_at", null);
  if ((count ?? 0) >= MAX_ACTIVE_TOKENS) {
    throw createError({ statusCode: 409, message: "Too many active API tokens; revoke one first" });
  }

  const { token, prefix, hash } = await generateApiToken();
  const { data, error } = await supabase
    .from("api_tokens")
    .insert({
      user_id: admin.id,
      name,
      prefix,
      token_hash: hash,
      scopes: [...new Set(scopes)],
      expires_at:
        expires_in_days === undefined
          ? null
          : new Date(Date.now() + expires_in_days * 86_400_000).toISOString(),
    })
    .select("id, name, prefix, scopes, expires_at, last_used_at, revoked_at, created_at")
    .single();
  if (error) {
    throw createError({ statusCode: 500, message: "Failed to create API token" });
  }
  setHeader(event, "Cache-Control", "no-store");
  setResponseStatus(event, 201);
  return { token, record: data };
});
