"use client";

import type { TodayEditionData, TodayIndexData } from "@noir/dashboard-data";

import { useGeneratedData } from "../../hooks/use-generated-data";
import { useTodayDate } from "../../hooks/use-today-date";
import { EmptyState } from "../empty-state";
import { GeneratedDataState } from "./generated-data-state";
import { TodayDateNavigation } from "./today-date-navigation";
import { TodayEdition } from "./today-edition";

export function TodayDashboard() {
  const { data, error, loading, retry } = useGeneratedData<TodayIndexData>(
    "/generated/today/index.json",
  );
  const availableDates = data?.editions.map((edition) => edition.date) ?? [];
  const { selectedDate, selectDate, urlReady } = useTodayDate(availableDates);

  if (!data)
    return (
      <GeneratedDataState error={error} loading={loading} onRetry={retry} />
    );
  if (!data.editions.length)
    return (
      <EmptyState
        title="No daily editions yet"
        description="Run collection once. Successful zero-change runs also create a daily edition."
      />
    );
  if (!urlReady || !selectedDate)
    return <GeneratedDataState error={null} loading onRetry={retry} />;

  return (
    <div className="space-y-6">
      <TodayDateNavigation
        editions={data.editions}
        onSelect={selectDate}
        selectedDate={selectedDate}
      />
      <SelectedTodayEdition date={selectedDate} key={selectedDate} />
    </div>
  );
}

function SelectedTodayEdition({ date }: { date: string }) {
  const { data, error, loading, retry } = useGeneratedData<TodayEditionData>(
    `/generated/today/${date}.json`,
  );
  if (!data)
    return (
      <GeneratedDataState error={error} loading={loading} onRetry={retry} />
    );
  return <TodayEdition edition={data} />;
}
