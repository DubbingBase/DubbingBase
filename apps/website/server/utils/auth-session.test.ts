import { describe, expect, it } from "vitest";
import { hasSupabaseAuthCookie } from "./auth-session";

describe("hasSupabaseAuthCookie", () => {
  const cookiePrefix = "sb-project-auth-token";

  it("skips unrelated cookies", () => {
    expect(hasSupabaseAuthCookie("user_lang=fr; theme=dark", cookiePrefix)).toBe(false);
  });

  it("recognizes the configured Supabase auth cookie", () => {
    expect(hasSupabaseAuthCookie(`${cookiePrefix}=token`, cookiePrefix)).toBe(true);
  });

  it("recognizes chunked Supabase auth cookies", () => {
    expect(
      hasSupabaseAuthCookie(`${cookiePrefix}.0=part; ${cookiePrefix}.1=part`, cookiePrefix),
    ).toBe(true);
  });

  it("does not match a cookie with only a similar prefix", () => {
    expect(hasSupabaseAuthCookie(`${cookiePrefix}-other=token`, cookiePrefix)).toBe(false);
  });

  it("recognizes Supabase cookies when the configured prefix is unavailable", () => {
    expect(hasSupabaseAuthCookie("sb-project-auth-token=token", undefined)).toBe(true);
  });
});
