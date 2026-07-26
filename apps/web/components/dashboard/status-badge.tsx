const styles = {
  success: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
  partial: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  failure: "border-rose-400/20 bg-rose-400/10 text-rose-200",
  neutral: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  active: "border-violet-400/20 bg-violet-400/10 text-violet-200",
} as const;

export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: keyof typeof styles;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${styles[tone]}`}
    >
      {label}
    </span>
  );
}
