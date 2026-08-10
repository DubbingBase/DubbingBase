export async function getParams(req: Request): Promise<Record<string, any>> {
  if (req.method === "GET" || req.method === "HEAD") {
    const url = new URL(req.url);
    const params: Record<string, any> = {};
    for (const [key, value] of url.searchParams.entries()) {
      try {
        params[key] = JSON.parse(value);
      } catch {
        params[key] = value;
      }
    }
    return params;
  } else {
    try {
      return await req.json();
    } catch {
      return {};
    }
  }
}
