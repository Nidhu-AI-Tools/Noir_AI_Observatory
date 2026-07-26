import {
  healthCheckSchema,
  healthRunReportSchema,
} from "../packages/core/src/index";
import { MonitorRegistryService } from "../packages/monitoring/src/index";
import {
  JsonHealthRunReportStore,
  JsonlHealthCheckStore,
  YamlMonitorRegistryStore,
  YamlRegistryStore,
} from "../packages/storage/src/index";

const root = process.cwd();
const { registry } = await new MonitorRegistryService(
  new YamlMonitorRegistryStore(root),
  new YamlRegistryStore(root),
).validate();
const [checks, reports] = await Promise.all([
  new JsonlHealthCheckStore(root).readAll(),
  new JsonHealthRunReportStore(root).readAll(),
]);
checks.forEach((item) => healthCheckSchema.parse(item));
reports.forEach((item) => healthRunReportSchema.parse(item));
const ids = new Set<string>();
for (const check of checks) {
  if (ids.has(check.id))
    throw new Error(`Duplicate health check ID: ${check.id}`);
  ids.add(check.id);
}
console.log(
  `Health data is valid: ${registry.monitors.length} monitors, ${checks.length} checks, ${reports.length} run reports.`,
);
