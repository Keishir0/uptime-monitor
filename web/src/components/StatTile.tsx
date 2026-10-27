import { clsx } from "clsx";
import type { ReactNode } from "react";

/** Faixa de stats separados por linhas finas (o gap de 1px deixa o fundo `line` aparecer). */
export function StatGrid({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={clsx("grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4", className)}>
      {children}
    </div>
  );
}

export function StatTile({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="bg-surface px-5 py-4">
      <p className="eyebrow flex items-center gap-2">
        {icon}
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular text-fg sm:text-[28px]">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}
