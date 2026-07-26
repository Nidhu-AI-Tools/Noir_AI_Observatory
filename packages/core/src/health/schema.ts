import { z } from "zod";

import { sourceTagSchema } from "../source/schema";

const monitorIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const privateIpv4 =
  /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;

function validatePublicHttps(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Monitor URL must be valid.";
  }
  if (url.protocol !== "https:") return "Monitor URL must use HTTPS.";
  if (url.username || url.password)
    return "Monitor URL must not contain credentials.";
  const host = url.hostname.toLowerCase();
  const sensitiveQuery = [...url.searchParams.keys()].some((key) =>
    /token|secret|password|api[-_]?key|signature|authorization/i.test(key),
  );
  if (sensitiveQuery)
    return "Monitor URL must not contain credential-like query parameters.";
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.includes(":") ||
    host === "0.0.0.0" ||
    host.startsWith("100.64.") ||
    host.startsWith("198.18.") ||
    privateIpv4.test(host)
  ) {
    return "Monitor URL must target a public host.";
  }
  return undefined;
}

export const monitorConfigSchema = z
  .object({
    id: monitorIdSchema,
    displayName: z.string().trim().min(1).max(120),
    description: z.string().trim().max(500).optional(),
    url: z.url(),
    method: z.enum(["GET", "HEAD"]),
    expectedStatuses: z.array(z.number().int().min(100).max(599)).min(1),
    timeoutMs: z.number().int().min(1_000).max(30_000),
    degradedAfterMs: z.number().int().min(1).max(30_000),
    categoryId: monitorIdSchema,
    tags: z.array(sourceTagSchema),
    linkedSourceId: monitorIdSchema.optional(),
    enabled: z.boolean(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((monitor, context) => {
    const urlError = validatePublicHttps(monitor.url);
    if (urlError)
      context.addIssue({ code: "custom", message: urlError, path: ["url"] });
    if (monitor.degradedAfterMs >= monitor.timeoutMs) {
      context.addIssue({
        code: "custom",
        message: "Degraded threshold must be less than timeout.",
        path: ["degradedAfterMs"],
      });
    }
    if (
      new Set(monitor.expectedStatuses).size !== monitor.expectedStatuses.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Expected statuses must be unique.",
        path: ["expectedStatuses"],
      });
    }
  });

export const monitorRegistrySchema = z
  .object({ version: z.literal(1), monitors: z.array(monitorConfigSchema) })
  .strict()
  .superRefine((registry, context) => {
    const ids = new Set<string>();
    const endpoints = new Set<string>();
    registry.monitors.forEach((monitor, index) => {
      if (ids.has(monitor.id))
        context.addIssue({
          code: "custom",
          message: `Duplicate monitor ID: ${monitor.id}`,
          path: ["monitors", index, "id"],
        });
      ids.add(monitor.id);
      const endpoint = `${monitor.method}:${monitor.url}`;
      if (endpoints.has(endpoint))
        context.addIssue({
          code: "custom",
          message: `Duplicate monitor endpoint: ${monitor.url}`,
          path: ["monitors", index, "url"],
        });
      endpoints.add(endpoint);
    });
  });

export const healthCheckSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().min(1).max(300),
    monitorId: monitorIdSchema,
    runId: z.string().min(1).max(200),
    checkedAt: z.iso.datetime({ offset: true }),
    finishedAt: z.iso.datetime({ offset: true }),
    status: z.enum(["healthy", "degraded", "down"]),
    statusCode: z.number().int().min(100).max(599).optional(),
    latencyMs: z.number().int().nonnegative(),
    expectedStatus: z.boolean(),
    errorCode: z
      .enum(["timeout", "network", "redirect", "unexpected-status"])
      .optional(),
    errorMessage: z.string().max(300).optional(),
    vantage: z.enum(["github-actions-ubuntu", "local"]),
  })
  .strict();

export const healthRunReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    runId: z.string().min(1).max(200),
    trigger: z.enum(["schedule", "manual", "local"]),
    startedAt: z.iso.datetime({ offset: true }),
    finishedAt: z.iso.datetime({ offset: true }),
    status: z.enum(["success", "partial", "failure"]),
    totals: z
      .object({
        configured: z.number().int().nonnegative(),
        attempted: z.number().int().nonnegative(),
        skipped: z.number().int().nonnegative(),
        healthy: z.number().int().nonnegative(),
        degraded: z.number().int().nonnegative(),
        down: z.number().int().nonnegative(),
        internalFailures: z.number().int().nonnegative(),
      })
      .strict(),
    monitors: z.array(
      z
        .object({
          monitorId: monitorIdSchema,
          status: z.enum(["healthy", "degraded", "down", "skipped", "failed"]),
          latencyMs: z.number().int().nonnegative(),
          error: z.string().max(300).optional(),
        })
        .strict(),
    ),
  })
  .strict();

export type MonitorConfig = z.infer<typeof monitorConfigSchema>;
export type MonitorRegistry = z.infer<typeof monitorRegistrySchema>;
export type HealthCheck = z.infer<typeof healthCheckSchema>;
export type HealthRunReport = z.infer<typeof healthRunReportSchema>;

export interface MonitorCandidate {
  displayName: string;
  description?: string;
  url: string;
  method?: "GET" | "HEAD";
  expectedStatuses?: number[];
  timeoutMs?: number;
  degradedAfterMs?: number;
  categoryId: string;
  tags: string[];
  linkedSourceId?: string;
  enabled?: boolean;
}

export type MonitorUpdate = Partial<
  Pick<
    MonitorConfig,
    | "displayName"
    | "description"
    | "expectedStatuses"
    | "timeoutMs"
    | "degradedAfterMs"
    | "categoryId"
    | "tags"
    | "linkedSourceId"
    | "enabled"
  >
>;
