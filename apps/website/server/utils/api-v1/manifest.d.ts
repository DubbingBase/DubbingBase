declare module "#api-v1-manifest" {
  const manifest: {
    route: string;
    method: string;
    module: { route?: { docs: import("./define").ApiRouteDocs } };
  }[];
  export default manifest;
}
