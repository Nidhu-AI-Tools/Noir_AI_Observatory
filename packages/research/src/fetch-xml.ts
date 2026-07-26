export type ResearchFetch = typeof fetch;

function isPublicHttps(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      host !== "localhost" &&
      !host.endsWith(".local") &&
      !host.includes(":") &&
      !/^(?:0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(
        host,
      )
    );
  } catch {
    return false;
  }
}

export async function fetchXml(
  initialUrl: string,
  fetcher: ResearchFetch,
  options: {
    timeoutMs?: number;
    maxBytes?: number;
    allowArxivHttp?: boolean;
  } = {},
): Promise<string> {
  let url = initialUrl;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxBytes = options.maxBytes ?? 2_000_000;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    if (
      !isPublicHttps(url) &&
      !(options.allowArxivHttp && url.startsWith("http://export.arxiv.org/"))
    )
      throw new Error("Request URL must target a public HTTPS host.");
    const response = await fetcher(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept:
          "application/atom+xml, application/rss+xml, application/xml, text/xml",
        "user-agent": "Noir-AI-Observatory/1.0 (research metadata collector)",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect response omitted Location.");
      url = new URL(location, url).toString();
      continue;
    }
    if (!response.ok)
      throw new Error(`Request failed with HTTP ${response.status}.`);
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > maxBytes)
      throw new Error("XML response exceeds the size limit.");
    const body = await response.text();
    if (Buffer.byteLength(body, "utf8") > maxBytes)
      throw new Error("XML response exceeds the size limit.");
    return body;
  }
  throw new Error("Request exceeded the redirect limit.");
}
