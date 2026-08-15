"use client";

import type {
  DashboardResearchItem,
  ResearchIndexData,
} from "@noir/dashboard-data";
import { useEffect, useState } from "react";

import {
  loadResearchPage,
  loadResearchSearch,
} from "../lib/research-repository";
import { searchResearch } from "../lib/research-search";
import type { ResearchUrlState } from "../lib/research-url";

export interface ResearchResultsState {
  items: DashboardResearchItem[];
  total: number;
  page: number;
  pageCount: number;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

function requiresSearch(state: ResearchUrlState) {
  return (
    Boolean(state.query) ||
    state.organization !== "all" ||
    state.venue !== "all" ||
    state.topic !== "all" ||
    state.type !== "all" ||
    state.source !== "all" ||
    state.tag !== "all" ||
    state.arxiv !== "all" ||
    state.window !== "all" ||
    Boolean(state.from || state.to) ||
    state.sort !== "newest"
  );
}

export function useResearchResults(
  index: ResearchIndexData | null,
  state: ResearchUrlState,
): ResearchResultsState {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Omit<ResearchResultsState, "retry">>({
    items: [],
    total: 0,
    page: 1,
    pageCount: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!index) return;
    const controller = new AbortController();
    queueMicrotask(() =>
      setResult((current) => ({ ...current, loading: true, error: null })),
    );
    const load = async () => {
      if (!requiresSearch(state)) {
        const page = Math.min(
          Math.max(1, state.page),
          Math.max(1, index.pageCount),
        );
        const shard = index.pageCount
          ? await loadResearchPage(index, page)
          : null;
        return {
          items: shard?.items ?? [],
          total: index.summary.total,
          page,
          pageCount: index.pageCount,
        };
      }
      const search = await loadResearchSearch(index);
      const matches = searchResearch(search.documents, state, index);
      const pageCount = Math.ceil(matches.length / index.pageSize);
      const page = Math.min(Math.max(1, state.page), Math.max(1, pageCount));
      const selected = matches.slice(
        (page - 1) * index.pageSize,
        page * index.pageSize,
      );
      const shardPages = [
        ...new Set(selected.map((match) => match.document.page)),
      ];
      const shards = await Promise.all(
        shardPages.map((value) => loadResearchPage(index, value)),
      );
      const byId = new Map(
        shards.flatMap((shard) => shard.items).map((item) => [item.id, item]),
      );
      return {
        items: selected.flatMap((match) => {
          const item = byId.get(match.document.id);
          return item ? [item] : [];
        }),
        total: matches.length,
        page,
        pageCount,
      };
    };
    void load()
      .then((value) => {
        if (!controller.signal.aborted)
          setResult({ ...value, loading: false, error: null });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setResult({
            items: [],
            total: 0,
            page: 1,
            pageCount: 0,
            loading: false,
            error:
              reason instanceof Error
                ? reason.message
                : "Research results could not be loaded.",
          });
      });
    return () => controller.abort();
  }, [attempt, index, state]);

  return { ...result, retry: () => setAttempt((value) => value + 1) };
}
