import { clsx } from "clsx";
import { CircleCheck, CircleDashed, CirclePause, CircleX, TriangleAlert, type LucideIcon } from "lucide-react";
import type { MonitorStatus, OverallStatus } from "../lib/types";

// Status nunca é só cor: sempre ícone + rótulo, a cor reforça.
const MONITOR_STATUS: Record<MonitorStatus, { label: string; icon: LucideIcon; color: string; dot: string }> = {
  UP: { label: "Online", icon: CircleCheck, color: "text-good", dot: "bg-good" },
  DOWN: { label: "Fora do ar", icon: CircleX, color: "text-bad", dot: "bg-bad" },
  PENDING: { label: "Aguardando", icon: CircleDashed, color: "text-muted", dot: "bg-idle" },
  PAUSED: { label: "Pausado", icon: CirclePause, color: "text-muted", dot: "bg-idle" },
};

export function statusLabel(status: MonitorStatus) {
  return MONITOR_STATUS[status].label;
}

export function StatusBadge({ status, size = "md" }: { status: MonitorStatus; size?: "sm" | "md" }) {
  const { label, icon: Icon, color } = MONITOR_STATUS[status];
  return (
    <span className={clsx("inline-flex items-center gap-1.5 font-medium text-fg", size === "sm" ? "text-xs" : "text-sm")}>
      <Icon className={clsx(color, size === "sm" ? "size-3.5" : "size-4")} aria-hidden />
      {label}
    </span>
  );
}

/** Ponto de status com "pulso" quando fora do ar (chama atenção na lista). */
export function StatusDot({ status }: { status: MonitorStatus }) {
  const { dot, label } = MONITOR_STATUS[status];
  return (
    <span className="relative flex size-2.5 shrink-0" role="img" aria-label={label}>
      {status === "DOWN" && <span className={clsx("absolute inline-flex size-full animate-ping rounded-full opacity-60", dot)} />}
      <span className={clsx("relative inline-flex size-2.5 rounded-full", dot)} />
    </span>
  );
}

export const OVERALL_STATUS: Record<OverallStatus, { title: string; icon: LucideIcon; tone: string }> = {
  OPERATIONAL: { title: "Todos os sistemas operacionais", icon: CircleCheck, tone: "bg-good" },
  PARTIAL_OUTAGE: { title: "Instabilidade parcial", icon: TriangleAlert, tone: "bg-warn" },
  MAJOR_OUTAGE: { title: "Indisponibilidade geral", icon: CircleX, tone: "bg-bad" },
  UNKNOWN: { title: "Status indisponível no momento", icon: CircleDashed, tone: "bg-idle" },
};
