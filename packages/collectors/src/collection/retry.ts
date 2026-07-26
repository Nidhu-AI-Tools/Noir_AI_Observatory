export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    attempts?: number;
    shouldRetry?: (error: unknown) => boolean;
    delay?: (attempt: number) => Promise<void>;
  } = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !(options.shouldRetry?.(error) ?? false)) {
        throw error;
      }
      await (options.delay?.(attempt) ??
        new Promise((resolve) => setTimeout(resolve, attempt * 250)));
    }
  }
  throw lastError;
}
