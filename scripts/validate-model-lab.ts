import {
  modelLabResponseSchema,
  modelLabRunReportSchema,
} from "../packages/core/src/index";
import { ModelLabRegistryService } from "../packages/model-lab/src/index";
import {
  JsonModelLabRunReportStore,
  JsonlModelLabResponseStore,
  YamlBenchmarkCaseStore,
  YamlBenchmarkSuiteStore,
  YamlModelLabConfigStore,
} from "../packages/storage/src/index";

const root = process.cwd();
const configStore = new YamlModelLabConfigStore(root);
const suiteStore = new YamlBenchmarkSuiteStore(root);
const caseStore = new YamlBenchmarkCaseStore(root);
const [{ config, suites, cases }, responses, reports] = await Promise.all([
  new ModelLabRegistryService(configStore, suiteStore, caseStore).validate(),
  new JsonlModelLabResponseStore(root).readAll(),
  new JsonModelLabRunReportStore(root).readAll(),
]);
const ids = new Set<string>();
for (const response of responses) {
  modelLabResponseSchema.parse(response);
  if (ids.has(response.id))
    throw new Error(`Duplicate Model Lab response ID: ${response.id}`);
  ids.add(response.id);
}
reports.forEach((report) => modelLabRunReportSchema.parse(report));
console.log(
  `Model Lab data is valid: ${config.models.length} models, ${suites.length} suites, ${cases.length} gold cases, ${responses.length} responses, ${reports.length} reports.`,
);
