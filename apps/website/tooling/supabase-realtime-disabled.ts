const disabled = (): never => {
  throw new Error("Supabase Realtime is disabled in this website build");
};

export class RealtimeClient {
  constructor(_endPoint: string, _options: Record<string, unknown>) {}

  setAuth(_token?: string): void {}

  channel(..._args: unknown[]): never {
    return disabled();
  }

  getChannels(): never {
    return disabled();
  }

  removeChannel(..._args: unknown[]): never {
    return disabled();
  }

  removeAllChannels(): never {
    return disabled();
  }
}
