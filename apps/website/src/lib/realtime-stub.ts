/**
 * Browser-only stand-in for `@supabase/realtime-js`, aliased in nuxt.config.ts.
 *
 * `@supabase/supabase-js` always constructs a realtime client and so pulls the websocket client
 * (`realtime-js` plus `phoenix`, about 26 KB gzipped) into the entry chunk, which loads before
 * the first paint. The website never subscribes to a realtime channel, so this implements only
 * the five methods supabase-js 2.x calls on `client.realtime` and fails loudly if a channel is
 * ever requested. Remove the alias to use realtime.
 */
export class RealtimeClient {
  setAuth(): void {}

  channel(): never {
    throw new Error("Supabase realtime is not bundled in the browser build");
  }

  getChannels(): [] {
    return [];
  }

  removeChannel(): Promise<"ok"> {
    return Promise.resolve("ok");
  }

  removeAllChannels(): Promise<[]> {
    return Promise.resolve([]);
  }
}
