import type { ReactNode } from "react";

export function StatTile({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
      <p className="flex items-center gap-1.5 text-sm text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-fg">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
