"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { resolveTodayDate, todayPath } from "../lib/today-url";

export function useTodayDate(availableDates: string[]) {
  const [requestedDate, setRequestedDate] = useState("");
  const [urlReady, setUrlReady] = useState(false);
  const selectedDate = useMemo(
    () => (urlReady ? resolveTodayDate(availableDates, requestedDate) : ""),
    [availableDates, requestedDate, urlReady],
  );

  useEffect(() => {
    const readUrl = () => {
      setRequestedDate(
        new URLSearchParams(window.location.search).get("date") ?? "",
      );
      setUrlReady(true);
    };
    queueMicrotask(readUrl);
    window.addEventListener("popstate", readUrl);
    return () => window.removeEventListener("popstate", readUrl);
  }, []);

  useEffect(() => {
    if (!urlReady || !selectedDate) return;
    const current =
      new URLSearchParams(window.location.search).get("date") ?? "";
    if (current === selectedDate) return;
    window.history.replaceState(
      null,
      "",
      todayPath(selectedDate, window.location.pathname),
    );
  }, [selectedDate, urlReady]);

  const selectDate = useCallback((date: string) => {
    setRequestedDate(date);
    window.history.pushState(
      null,
      "",
      todayPath(date, window.location.pathname),
    );
  }, []);

  return { selectedDate, selectDate, urlReady };
}
