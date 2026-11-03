/** Returns the first value of a vue-router param, which may be a string or a string array. */
export function firstRouteParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
