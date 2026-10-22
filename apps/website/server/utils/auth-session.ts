export function hasSupabaseAuthCookie(
  cookieHeader: string | undefined,
  cookiePrefix: string | undefined,
): boolean {
  if (!cookieHeader) return false;

  for (const cookie of cookieHeader.split(";")) {
    const separator = cookie.indexOf("=");
    if (separator < 0) continue;

    const name = cookie.slice(0, separator).trim();
    if (cookiePrefix) {
      if (name === cookiePrefix || name.startsWith(`${cookiePrefix}.`)) return true;
    } else if (name.startsWith("sb-")) {
      return true;
    }
  }

  return false;
}
