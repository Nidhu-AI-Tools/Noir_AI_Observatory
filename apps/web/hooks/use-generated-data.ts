"use client";

import { useCallback, useEffect, useState } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function useGeneratedData<T>(path: string): {
  data: T | null;
  error: string | null;
  loading: boolean;
  retry: () => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    setLoading(true);
    setError(null);
    setData(null);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${basePath}${path}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Data returned ${response.status}.`);
        return (await response.json()) as T;
      })
      .then((value) => {
        setData(value);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Data could not be loaded.",
        );
        setLoading(false);
      });
    return () => controller.abort();
  }, [attempt, path]);

  return { data, error, loading, retry };
}
