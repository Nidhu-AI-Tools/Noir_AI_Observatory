import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

function visit(value: unknown, location: string, errors: string[]) {
  if (Array.isArray(value))
    return value.forEach((item, index) =>
      visit(item, `${location}[${index}]`, errors),
    );
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const childLocation = `${location}.${key}`;
    if (typeof child === "string" && /(?:url|href)$/i.test(key)) {
      try {
        const url = new URL(child);
        if (url.protocol !== "https:")
          errors.push(`${childLocation} must use HTTPS: ${child}`);
        if (["localhost", "127.0.0.1", "::1"].includes(url.hostname))
          errors.push(`${childLocation} must not target loopback: ${child}`);
        if (
          url.hostname === "huggingface.co" &&
          /^\/[a-f0-9]{24}\/?$/i.test(url.pathname)
        )
          errors.push(
            `${childLocation} uses an internal Hugging Face ID: ${child}`,
          );
      } catch {
        errors.push(`${childLocation} is not an absolute URL: ${child}`);
      }
    }
    visit(child, childLocation, errors);
  }
}

async function files(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory()
          ? files(target)
          : entry.name.endsWith(".json")
            ? [target]
            : [];
      }),
    )
  ).flat();
}

const root = process.cwd();
const generated = path.join(root, "apps", "web", "public", "generated");
const errors: string[] = [];
for (const file of await files(generated))
  visit(
    JSON.parse(await readFile(file, "utf8")),
    path.relative(root, file),
    errors,
  );
if (errors.length)
  throw new Error(`Generated link audit failed:\n${errors.join("\n")}`);
console.log("Generated link audit passed.");
