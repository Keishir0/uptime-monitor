import { clsx } from "clsx";
import { useState } from "react";
import { formatDay, formatUptime } from "../lib/format";
import type { DailyBar } from "../lib/types";

type Tone = { label: string; className: string };

const TONES = {
  none: { label: "Sem dados", className: "bg-idle" },
  good: { label: "Operacional", className: "bg-good" },
  warn: { label: "Instabilidade", className: "bg-warn" },
  bad: { label: "Indisponibilidade", className: "bg-bad" },
} satisfies Record<string, Tone>;

export function dayTone(uptime: number | null): Tone {
  if (uptime === null) return TONES.none;
  if (uptime === 100) return TONES.good;
  if (uptime >= 95) return TONES.warn;
  return TONES.bad;
}

/** Em telas estreitas 90 barras ficam finas demais: mostra só os últimos 30 dias. */
const MOBILE_DAYS = 30;

export function UptimeBars({ days, uptimePercent }: { days: DailyBar[]; uptimePercent: number | null }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const hoveredDay = hovered === null ? null : days[hovered];
  const mobileStart = Math.max(0, days.length - MOBILE_DAYS);

  // Posição do tooltip: centralizado na barra, mas preso às bordas do componente.
  const position = hovered === null ? 0 : (hovered + 0.5) / days.length;
  const align = position < 0.15 ? "left" : position > 0.85 ? "right" : "center";

  return (
    <div className="relative" onPointerLeave={() => setHovered(null)}>
      <ol
        className="flex h-9 items-stretch gap-[2px]"
        aria-label={`Disponibilidade diária dos últimos ${days.length} dias: ${formatUptime(uptimePercent)} de uptime`}
      >
        {days.map((day, index) => {
          const tone = dayTone(day.uptimePercent);
          return (
            <li
              key={day.date}
              aria-label={`${formatDay(day.date)}: ${tone.label}${day.uptimePercent !== null ? `, ${formatUptime(day.uptimePercent)}` : ""}`}
              onPointerEnter={() => setHovered(index)}
              onClick={() => setHovered(index)}
              className={clsx(
                "min-w-0 flex-1 cursor-default rounded-[2px] transition-opacity",
                tone.className,
                hovered !== null && hovered !== index && "opacity-50",
                index < mobileStart && "hidden sm:block",
              )}
            />
          );
        })}
      </ol>

      {hoveredDay && (
        <div
          role="tooltip"
          className={clsx(
            "pointer-events-none absolute bottom-full z-10 mb-2 w-56 rounded-lg border border-line bg-surface p-3 text-sm shadow-lg",
            align === "center" && "-translate-x-1/2",
            align === "right" && "-translate-x-full",
          )}
          style={{ left: align === "left" ? 0 : align === "right" ? "100%" : `${position * 100}%` }}
        >
          <p className="font-medium text-fg">{formatDay(hoveredDay.date)}</p>
          <p className="mt-1 flex items-center gap-2 text-fg-2">
            <span className={clsx("size-2.5 rounded-[2px]", dayTone(hoveredDay.uptimePercent).className)} aria-hidden />
            {dayTone(hoveredDay.uptimePercent).label}
            {hoveredDay.uptimePercent !== null && <span className="ml-auto tabular text-fg">{formatUptime(hoveredDay.uptimePercent)}</span>}
          </p>
          <p className="mt-1 text-xs text-muted">
            {hoveredDay.total === 0
              ? "Nenhum check registrado neste dia"
              : hoveredDay.failed === 0
                ? `${hoveredDay.total.toLocaleString("pt-BR")} checks, nenhuma falha`
                : `${hoveredDay.failed.toLocaleString("pt-BR")} de ${hoveredDay.total.toLocaleString("pt-BR")} checks falharam`}
          </p>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
        <span>
          <span className="sm:hidden">{Math.min(MOBILE_DAYS, days.length)} dias atrás</span>
          <span className="hidden sm:inline">{days.length} dias atrás</span>
        </span>
        <span className="h-px flex-1 bg-line" aria-hidden />
        <span className="tabular">{formatUptime(uptimePercent, 3)} de uptime</span>
        <span className="h-px flex-1 bg-line" aria-hidden />
        <span>Hoje</span>
      </div>
    </div>
  );
}

export function UptimeLegend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-2">
      {Object.values(TONES).map((tone) => (
        <li key={tone.label} className="flex items-center gap-1.5">
          <span className={clsx("size-2.5 rounded-[2px]", tone.className)} aria-hidden />
          {tone.label}
        </li>
      ))}
    </ul>
  );
}
