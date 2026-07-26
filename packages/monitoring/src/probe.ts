import {
  healthCheckSchema,
  type HealthCheck,
  type MonitorConfig,
} from "@noir/core";

export type HttpFetch = (input: string, init: RequestInit) => Promise<Response>;

function sanitized(error: unknown): string {
  return (error instanceof Error ? error.message : "Network request failed")
    .replace(/(Bearer|token)\s+[A-Za-z0-9._-]+/gi, "$1 [redacted]")
    .slice(0, 300);
}

export async function probeMonitor(
  monitor: MonitorConfig,
  runId: string,
  options: {
    fetcher?: HttpFetch;
    clock?: () => Date;
    vantage?: HealthCheck["vantage"];
  } = {},
): Promise<HealthCheck> {
  const fetcher = options.fetcher ?? fetch;
  const clock = options.clock ?? (() => new Date());
  const started = clock();
  let statusCode: number | undefined;
  try {
    let currentUrl = monitor.url;
    const originalHost = new URL(currentUrl).hostname;
    let response: Response | undefined;
    for (let redirects = 0; redirects <= 3; redirects += 1) {
      response = await fetcher(currentUrl, {
        method: monitor.method,
        redirect: "manual",
        signal: AbortSignal.timeout(monitor.timeoutMs),
        headers: { "User-Agent": "Noir-AI-Observatory/1.0" },
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      if (redirects === 3) throw new Error("redirect-limit");
      const location = response.headers.get("location");
      if (!location) throw new Error("redirect-missing-location");
      const target = new URL(location, currentUrl);
      if (target.protocol !== "https:" || target.hostname !== originalHost)
        throw new Error("unsafe-redirect");
      currentUrl = target.toString();
    }
    if (!response) throw new Error("No response received");
    statusCode = response.status;
    const finished = clock();
    const latencyMs = Math.max(0, finished.valueOf() - started.valueOf());
    const expectedStatus = monitor.expectedStatuses.includes(statusCode);
    return healthCheckSchema.parse({
      schemaVersion: 1,
      id: `${monitor.id}:${runId}`,
      monitorId: monitor.id,
      runId,
      checkedAt: started.toISOString(),
      finishedAt: finished.toISOString(),
      status: !expectedStatus
        ? "down"
        : latencyMs > monitor.degradedAfterMs
          ? "degraded"
          : "healthy",
      statusCode,
      latencyMs,
      expectedStatus,
      ...(!expectedStatus ? { errorCode: "unexpected-status" } : {}),
      vantage: options.vantage ?? "local",
    });
  } catch (error) {
    const finished = clock();
    const message = sanitized(error);
    return healthCheckSchema.parse({
      schemaVersion: 1,
      id: `${monitor.id}:${runId}`,
      monitorId: monitor.id,
      runId,
      checkedAt: started.toISOString(),
      finishedAt: finished.toISOString(),
      status: "down",
      ...(statusCode ? { statusCode } : {}),
      latencyMs: Math.max(0, finished.valueOf() - started.valueOf()),
      expectedStatus: false,
      errorCode: message.toLowerCase().includes("timeout")
        ? "timeout"
        : message.includes("redirect")
          ? "redirect"
          : "network",
      errorMessage: message,
      vantage: options.vantage ?? "local",
    });
  }
}
