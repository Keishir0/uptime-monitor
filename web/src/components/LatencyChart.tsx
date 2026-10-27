import { useId, useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDateTime, formatLatency, formatShortDay, formatTime } from "../lib/format";
import type { StatsPoint, StatsRange } from "../lib/types";

type ChartPoint = StatsPoint & { t: number };

type Props = { series: StatsPoint[]; bucketMinutes: number; range: StatsRange };

export function LatencyChart({ series, bucketMinutes, range }: Props) {
  // useId pode conter caracteres inválidos em url(#id) do SVG
  const gradientId = `latency-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const bucketMs = bucketMinutes * 60_000;

  const data = useMemo<ChartPoint[]>(() => series.map((p) => ({ ...p, t: new Date(p.bucket).getTime() })), [series]);

  // Buckets com falha viram faixas contíguas sombreadas: mostra *quando* houve queda.
  const failureRanges = useMemo(() => {
    const ranges: { from: number; to: number }[] = [];
    for (const point of data) {
      if (point.failed === 0) continue;
      const last = ranges.at(-1);
      if (last && last.to === point.t) last.to = point.t + bucketMs;
      else ranges.push({ from: point.t, to: point.t + bucketMs });
    }
    return ranges;
  }, [data, bucketMs]);

  const hasLatency = data.some((p) => p.avgLatencyMs !== null);
  if (!hasLatency) {
    return <p className="flex h-60 items-center justify-center text-sm text-muted">Sem checks bem-sucedidos no período.</p>;
  }

  const tickFormatter = (t: number) => (range === "24h" ? formatTime(new Date(t).toISOString()) : formatShortDay(new Date(t).toISOString()));

  return (
    <div className="h-60 w-full" role="img" aria-label="Gráfico de latência média ao longo do período">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--series)" stopOpacity={0.18} />
              <stop offset="100%" stopColor="var(--series)" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />

          {failureRanges.map((r) => (
            <ReferenceArea key={r.from} x1={r.from} x2={r.to} fill="var(--bad)" fillOpacity={0.12} ifOverflow="hidden" />
          ))}

          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={tickFormatter}
            tick={{ fill: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            minTickGap={48}
          />
          <YAxis
            width={44}
            tickFormatter={(v: number) => `${v}`}
            tick={{ fill: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />

          <Tooltip
            cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as ChartPoint | undefined;
              if (!active || !point) return null;
              return <LatencyTooltip point={point} bucketMs={bucketMs} />;
            }}
          />

          <Area
            type="monotone"
            dataKey="avgLatencyMs"
            stroke="var(--series)"
            strokeWidth={1.75}
            fill={`url(#${gradientId})`}
            connectNulls={false}
            dot={false}
            activeDot={{ r: 4, fill: "var(--series)", stroke: "var(--surface)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function LatencyTooltip({ point, bucketMs }: { point: ChartPoint; bucketMs: number }) {
  const end = new Date(point.t + bucketMs).toISOString();
  return (
    <div className="min-w-48 rounded-lg border border-line bg-surface p-3 text-sm shadow-lg">
      <p className="text-xs text-muted">
        {formatDateTime(point.bucket)} – {formatTime(end)}
      </p>
      {point.total === 0 ? (
        <p className="mt-1 text-fg-2">Sem checks neste intervalo</p>
      ) : (
        <dl className="mt-1.5 space-y-1">
          <div className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-1.5 text-fg-2">
              <span className="h-0.5 w-3 rounded-full bg-series" aria-hidden />
              Latência média
            </dt>
            <dd className="font-medium tabular text-fg">{formatLatency(point.avgLatencyMs)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="pl-[18px] text-fg-2">Máxima</dt>
            <dd className="tabular text-fg">{formatLatency(point.maxLatencyMs)}</dd>
          </div>
          {point.failed > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="flex items-center gap-1.5 text-fg-2">
                <span className="size-3 rounded-[2px] bg-bad/30" aria-hidden />
                Falhas
              </dt>
              <dd className="tabular text-fg">
                {point.failed} de {point.total}
              </dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
