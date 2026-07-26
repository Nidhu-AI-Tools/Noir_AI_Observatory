import { EmptyState } from "../empty-state";

export function GeneratedDataState({
  error,
  loading,
  onRetry,
}: {
  error: string | null;
  loading: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <EmptyState
        description="Reading the latest generated dashboard data."
        title="Loading observatory"
      />
    );
  }
  return (
    <div className="space-y-4">
      <EmptyState
        description={error ?? "The generated data file is unavailable."}
        title="Dashboard data could not be loaded"
      />
      <button
        className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm text-white hover:border-violet-400/50"
        onClick={onRetry}
        type="button"
      >
        Try again
      </button>
    </div>
  );
}
