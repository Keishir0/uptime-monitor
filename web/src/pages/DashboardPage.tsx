import { clsx } from "clsx";
import { ChevronRight, Plus, Server } from "lucide-react";
import { Link } from "react-router";
import { StatusBadge, StatusDot } from "../components/status";
import { StatGrid, StatTile } from "../components/StatTile";
import { buttonClasses, Card, EmptyState, ErrorState, Spinner } from "../components/ui";
import { formatInterval, formatLatency, formatRelative, formatSince, formatUptime } from "../lib/format";
import { useMonitors } from "../lib/queries";
import type { MonitorWithStats } from "../lib/types";

export function DashboardPage() {
  const { data: monitors, isPending, error, refetch } = useMonitors();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Visão geral · atualiza a cada 15 s</p>
          <h1 className="mt-1.5 text-[28px] leading-tight font-semibold tracking-tight">Monitores</h1>
          <p className="mt-1 text-sm text-fg-2">Disponibilidade e latência dos seus serviços.</p>
        </div>
        <Link to="/monitors/new" className={buttonClasses("primary")}>
          <Plus className="size-4" aria-hidden />
          Novo monitor
        </Link>
      </div>

      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error.message} onRetry={() => void refetch()} />
      ) : monitors.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Server className="size-5" />}
            title="Nenhum monitor ainda"
            description="Cadastre a URL de um site ou API e o sistema passa a checá-la periodicamente, avisando quando cair."
            action={
              <Link to="/monitors/new" className={buttonClasses("primary")}>
                <Plus className="size-4" aria-hidden />
                Criar primeiro monitor
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <Summary monitors={monitors} />
          <MonitorList monitors={monitors} />
        </>
      )}
    </div>
  );
}

function Summary({ monitors }: { monitors: MonitorWithStats[] }) {
  const up = monitors.filter((m) => m.status === "UP").length;
  const down = monitors.filter((m) => m.status === "DOWN").length;
  const paused = monitors.filter((m) => m.status === "PAUSED").length;

  const withUptime = monitors.filter((m) => m.isActive && m.last24h.uptimePercent !== null);
  const avgUptime = withUptime.length
    ? withUptime.reduce((sum, m) => sum + (m.last24h.uptimePercent ?? 0), 0) / withUptime.length
    : null;

  return (
    <StatGrid>
      <StatTile label="Online" icon={<Swatch className="bg-good" />} value={up} hint={`de ${monitors.length} monitores`} />
      <StatTile
        label="Fora do ar"
        icon={<Swatch className="bg-bad" />}
        value={<span className={down > 0 ? "text-bad" : undefined}>{down}</span>}
        hint={down === 0 ? "nenhum incidente ativo" : "incidente em andamento"}
      />
      <StatTile label="Pausados" icon={<Swatch className="bg-idle" />} value={paused} hint="sem checagem" />
      <StatTile label="Uptime médio" icon={<Swatch className="bg-accent" />} value={formatUptime(avgUptime)} hint="últimas 24 horas" />
    </StatGrid>
  );
}

function Swatch({ className }: { className: string }) {
  return <span className={clsx("size-2 shrink-0", className)} aria-hidden />;
}

function MonitorList({ monitors }: { monitors: MonitorWithStats[] }) {
  // Quem está fora do ar aparece primeiro.
  const sorted = [...monitors].sort((a, b) => Number(b.status === "DOWN") - Number(a.status === "DOWN"));

  return (
    <Card className="overflow-hidden">
      <div className="hidden grid-cols-[minmax(0,1fr)_120px_110px_110px_120px_20px] gap-4 border-b border-line px-5 py-3 eyebrow md:grid">
        <span>Monitor</span>
        <span>Status</span>
        <span className="text-right">Uptime 24h</span>
        <span className="text-right">Latência</span>
        <span className="text-right">Último check</span>
        <span />
      </div>
      <ul className="divide-y divide-line">
        {sorted.map((monitor) => (
          <li key={monitor.id}>
            <MonitorRow monitor={monitor} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MonitorRow({ monitor }: { monitor: MonitorWithStats }) {
  return (
    <Link
      to={`/monitors/${monitor.id}`}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-4 transition hover:bg-surface-2 md:grid-cols-[minmax(0,1fr)_120px_110px_110px_120px_20px]"
    >
      <div className="flex min-w-0 items-center gap-3">
        <StatusDot status={monitor.status} />
        <div className="min-w-0">
          <p className="truncate font-medium text-fg">{monitor.name}</p>
          <p className="truncate font-mono text-[12.5px] text-muted">
            {monitor.url.replace(/^https?:\/\//, "")} · a cada {formatInterval(monitor.intervalSeconds)}
          </p>
        </div>
      </div>

      <div className="md:order-none">
        <StatusBadge status={monitor.status} size="sm" />
        {monitor.status === "DOWN" && <p className="mt-0.5 font-mono text-xs text-muted">há {formatSince(monitor.lastStatusChangeAt)}</p>}
      </div>

      {/* Métricas: linha extra no mobile, colunas no desktop */}
      <dl className="col-span-2 flex gap-6 pl-[22px] text-sm md:contents">
        <div className="md:text-right">
          <dt className="text-xs text-muted md:sr-only">Uptime 24h</dt>
          <dd className="font-mono text-fg">{formatUptime(monitor.last24h.uptimePercent)}</dd>
        </div>
        <div className="md:text-right">
          <dt className="text-xs text-muted md:sr-only">Latência média</dt>
          <dd className="font-mono text-fg">{formatLatency(monitor.last24h.avgLatencyMs)}</dd>
        </div>
        <div className="md:text-right">
          <dt className="text-xs text-muted md:sr-only">Último check</dt>
          <dd className="text-fg-2">{formatRelative(monitor.lastCheckedAt)}</dd>
        </div>
      </dl>

      <ChevronRight className="hidden size-4 text-muted md:block" aria-hidden />
    </Link>
  );
}
