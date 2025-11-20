export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
};

export function createResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

export function createErrorResponse(error: string, status = 500) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

export function handleOptions() {
  return new Response('ok', { headers: corsHeaders });
}

export function validateId(id: unknown): number {
  if (!id) {
    throw new Error('Missing id parameter');
  }

  const parsedId = parseInt(id as string, 10);
  if (isNaN(parsedId)) {
    throw new Error('Invalid id parameter');
  }

  return parsedId;
}

export function validateRequired(value: unknown, fieldName: string): void {
  if (!value) {
    throw new Error(`Missing required field: ${fieldName}`);
  }
}
