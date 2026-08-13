const HUGGING_FACE_ORIGIN = "https://huggingface.co";

export interface HuggingFaceModelIdentity {
  owner: string;
  repository: string;
  canonicalName: string;
  url: string;
}

function decodedPathSegments(url: URL): string[] {
  try {
    return url.pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    throw new Error("Provider URL contains invalid path encoding.");
  }
}

export function parseHuggingFaceModelIdentity(
  value: string,
): HuggingFaceModelIdentity {
  const canonicalName = value.trim();
  if (
    !canonicalName ||
    canonicalName.includes("?") ||
    canonicalName.includes("#") ||
    canonicalName.includes("\\")
  )
    throw new Error(`Invalid Hugging Face model name: ${value}`);
  const segments = canonicalName.split("/");
  if (
    segments.length !== 2 ||
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".." ||
        segment.includes("%2f") ||
        segment.includes("%2F"),
    )
  )
    throw new Error(
      `Hugging Face model names must use owner/repository: ${value}`,
    );
  const [owner, repository] = segments as [string, string];
  const url = `${HUGGING_FACE_ORIGIN}/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}`;
  return { owner, repository, canonicalName, url };
}

export function assertHuggingFaceModelUrl(
  canonicalName: string,
  value: string,
): void {
  const identity = parseHuggingFaceModelIdentity(canonicalName);
  const url = new URL(value);
  if (
    url.origin !== HUGGING_FACE_ORIGIN ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    decodedPathSegments(url).join("/") !== identity.canonicalName
  )
    throw new Error(
      `Hugging Face URL does not match ${identity.canonicalName}: ${value}`,
    );
}

export function assertHuggingFaceOwner(
  canonicalName: string,
  expectedOwner: string,
): void {
  const { owner } = parseHuggingFaceModelIdentity(canonicalName);
  if (owner.toLowerCase() !== expectedOwner.trim().toLowerCase())
    throw new Error(
      `Hugging Face model owner ${owner} does not match tracked owner ${expectedOwner}.`,
    );
}

export function assertGitHubReleaseUrl(
  repository: string,
  tagName: string,
  value: string,
): void {
  const repositorySegments = repository.trim().split("/");
  if (
    repositorySegments.length !== 2 ||
    repositorySegments.some((segment) => !segment)
  )
    throw new Error(`Invalid GitHub repository locator: ${repository}`);
  const url = new URL(value);
  const segments = decodedPathSegments(url);
  if (
    url.origin !== "https://github.com" ||
    url.search ||
    url.hash ||
    segments.length < 5 ||
    segments[0]?.toLowerCase() !== repositorySegments[0]?.toLowerCase() ||
    segments[1]?.toLowerCase() !== repositorySegments[1]?.toLowerCase() ||
    segments[2] !== "releases" ||
    segments[3] !== "tag" ||
    segments.slice(4).join("/") !== tagName
  )
    throw new Error(
      `GitHub release URL does not match ${repository} tag ${tagName}: ${value}`,
    );
}
