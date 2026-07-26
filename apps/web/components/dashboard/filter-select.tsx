import type { ReactNode } from "react";

export function FilterSelect({
  children,
  label,
  onChange,
  value,
}: {
  children: ReactNode;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        aria-label={label}
        className="w-full rounded-lg border border-[var(--border)] bg-[#0c1015] px-3 py-2.5 text-sm text-white outline-none focus:border-violet-400"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  );
}
