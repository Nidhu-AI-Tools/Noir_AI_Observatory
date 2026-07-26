export interface HttpResponse<T = unknown> {
  status: number;
  data: T;
  headers: Headers;
}

export interface HttpClient {
  get<T = unknown>(
    url: string,
    options?: { headers?: Record<string, string> },
  ): Promise<HttpResponse<T>>;
}

export class FetchHttpClient implements HttpClient {
  constructor(private readonly timeoutMs = 10_000) {}

  async get<T>(
    url: string,
    options: { headers?: Record<string, string> } = {},
  ): Promise<HttpResponse<T>> {
    const response = await fetch(url, {
      ...(options.headers ? { headers: options.headers } : {}),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const data = contentType.includes("application/json")
      ? ((await response.json()) as T)
      : ((await response.text()) as T);
    return { status: response.status, data, headers: response.headers };
  }
}

export class SourceResolutionError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid_locator"
      | "not_found"
      | "rate_limited"
      | "unauthorized"
      | "invalid_response"
      | "network_error",
  ) {
    super(message);
    this.name = "SourceResolutionError";
  }
}
