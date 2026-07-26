interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ description, title }: EmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-8 text-center">
      <div className="mx-auto mb-4 size-2 rounded-full bg-violet-300 shadow-[0_0_18px_rgba(196,181,253,0.8)]" />
      <h2 className="text-base font-medium text-white">{title}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
    </div>
  );
}
