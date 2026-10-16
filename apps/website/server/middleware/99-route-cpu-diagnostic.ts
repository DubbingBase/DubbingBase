import { createRouteCpuSample } from "../utils/route-cpu-diagnostics";

export default defineEventHandler((event) => {
  const sample = createRouteCpuSample(event.path, event.method);
  if (sample) console.info(`route_cpu_sample:${JSON.stringify(sample)}`);
});
