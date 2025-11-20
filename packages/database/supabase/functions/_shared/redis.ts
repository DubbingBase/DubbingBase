import { IRedisClient } from './interfaces.ts';

/**
 * Simplified Redis client with clean error handling
 */
export class RedisClient implements IRedisClient {
  private restUrl: string;
  private restToken: string;

  constructor() {
    const restUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
    if (!restUrl) {
      throw new Error('UPSTASH_REDIS_REST_URL environment variable is required');
    }
    this.restUrl = restUrl;

    const restToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
    if (!restToken) {
      throw new Error('UPSTASH_REDIS_REST_TOKEN environment variable is required');
    }
    this.restToken = restToken;
  }

  private async makeRequest(command: string, args: string[] = []): Promise<any> {
    const url = `${this.restUrl}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.restToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([command, ...args]),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Upstash Redis API error: ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    let data: any;
    try {
      data = await response.json();
    } catch (parseError) {
      throw new Error(`Failed to parse Upstash Redis API response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    // Validate Upstash response structure
    if (typeof data !== 'object' || data === null) {
      throw new Error(`Invalid Upstash Redis API response format: expected object, got ${typeof data}`);
    }

    // Check for Upstash-specific error fields
    if ('error' in data) {
      throw new Error(`Upstash Redis API returned error: ${data.error}`);
    }

    // Return result field if present, otherwise the entire data
    return data.result !== undefined ? data.result : data;
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.makeRequest('GET', [key]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[REDIS] GET ${key} failed: ${errorMessage}`);
      return null;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<boolean> {
    try {
      const args = ttl ? [key, value, 'EX', ttl.toString()] : [key, value];
      const result = await this.makeRequest('SET', args);
      return result === 'OK';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[REDIS] SET ${key} failed: ${errorMessage}`);
      return false;
    }
  }

  async setex(key: string, ttl: number, value: string): Promise<boolean> {
    try {
      const result = await this.makeRequest('SET', [key, value, 'EX', ttl.toString()]);
      return result === 'OK';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[REDIS] SETEX ${key} failed: ${errorMessage}`);
      return false;
    }
  }

  async del(key: string): Promise<number> {
    try {
      const result = await this.makeRequest('DEL', [key]);
      return result || 0;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[REDIS] DEL ${key} failed: ${errorMessage}`);
      return 0;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.makeRequest('EXISTS', [key]);
      return result === 1;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[REDIS] EXISTS ${key} failed: ${errorMessage}`);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.makeRequest('TTL', [key]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[REDIS] TTL ${key} failed: ${errorMessage}`);
      return -1;
    }
  }

  async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const result = await this.makeRequest('EXPIRE', [key, ttl.toString()]);
      return result === 1;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[REDIS] EXPIRE ${key} failed: ${errorMessage}`);
      return false;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const result = await this.makeRequest('PING');
      return result === 'PONG';
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`[REDIS] PING failed: ${errorMessage}`);
      return false;
    }
  }
}