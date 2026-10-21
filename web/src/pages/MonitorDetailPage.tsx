import { clsx } from "clsx";
import { ArrowLeft, Bell, ExternalLink, Globe, Pause, Pencil, Play, Trash } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { LatencyChart } from "../components/LatencyChart";
import { StatusBadge } from "../components/status";
import { StatTile } from "../components/StatTile";
import { UptimeBars, UptimeLegend } from "../components/UptimeBars";
import { Button, buttonClasses, Card, CardHeader, ErrorState, Modal, Segmented, Spinner } from "../components/ui";
import { ApiError } from "../lib/api";
import { formatDateTime, formatInterval, formatLatency, formatRelative, formatSince, formatUptime } from "../lib/format";
import { useChecks, useDeleteMonitor, useMonitor, useMonitorDaily, useMonitorStats, useToggleMonitor } from "../lib/queries";
import type { Monitor, StatsRange } from "../lib/types";

const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: "24h", label: "24 horas" },
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
];

export function MonitorDetailPage() {
  const { id = "" } = useParams();
  const { data: monitor, isPending, error, refetch } = useMonitor(id);

  if (isPending) return <Spinner />;
  if (error) {
    if (error instanceof ApiError && error.status === 404) {
      return <ErrorState message="Este monitor não existe ou foi excluído." />;
    }
    return <ErrorState message={error.message} onRetry={() => void refetch()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <MonitorHeader monitor={monitor} />
      <StatsSection monitorId={monitor.id} />
      <AvailabilitySection monitorId={monitor.id} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <RecentChecks monitorId={monitor.id} />
        <ConfigCard monitor={monitor} />
      </div>
    </div>
  );
}

function MonitorHeader({ monitor }: { monitor: Monitor }) {
  const navigate = useNavigate();
  const toggle = useToggleMonitor(monitor.id);
  const remove = useDeleteMonitor();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden />
        Monitores
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{monitor.name}</h1>
          <a
            href={monitor.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex max-w-full items-center gap-1.5 text-sm text-muted hover:text-fg"
          >
            <span className="truncate">{monitor.url}</span>
            <ExternalLink className="size-3.5 shrink-0" aria-hidden />
          </a>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <StatusBadge status={monitor.status} />
            {monitor.lastStatusChangeAt && monitor.status !== "PENDING" && (
              <span className="text-muted">há {formatSince(monitor.lastStatusChangeAt)}</span>
            )}
            <span className="text-muted" aria-hidden>
              ·
            </span>
            <span className="text-muted">Último check {formatRelative(monitor.lastCheckedAt)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            icon={monitor.isActive ? <Pause className="size-4" /> : <Play className="size-4" />}
            loading={toggle.isPending}
            onClick={() => toggle.mutate(monitor.isActive ? "pause" : "resume")}
          >
            {monitor.isActive ? "Pausar" : "Retomar"}
          </Button>
          <Link to={`/monitors/${monitor.id}/edit`} className={buttonClasses()}>
            <Pencil className="size-4" aria-hidden />
            Editar
          </Link>
          <Button variant="ghost" icon={<Trash className="size-4" />} onClick={() => setConfirmDelete(true)} aria-label="Excluir monitor">
            <span className="hidden sm:inline">Excluir</span>
          </Button>
        </div>
      </div>

      <Modal open={confirmDelete} title="Excluir monitor" onClose={() => setConfirmDelete(false)}>
        <p className="text-sm text-fg-2">
          O monitor <strong className="text-fg">{monitor.name}</strong> e todo o seu histórico de checks serão apagados. Essa ação não pode ser desfeita.
        </p>
        {remove.error && <p className="mt-3 text-sm text-bad">{remove.error.message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setConfirmDelete(false)}>Cancelar</Button>
          <Button
            variant="danger"
            loading={remove.isPending}
            onClick={() => remove.mutate(monitor.id, { onSuccess: () => navigate("/", { replace: true }) })}
          >
            Excluir monitor
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function StatsSection({ monitorId }: { monitorId: string }) {
  const [range, setRange] = useState<StatsRange>("24h");
  const { data: stats, isPending, isFetching, error } = useMonitorStats(monitorId, range);
  const summary = stats?.summary;

  return (
    <section className="flex flex-col gap-4" aria-labelledby="stats-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="stats-title" className="text-sm font-semibold text-fg">
          Desempenho
        </h2>
        <Segmented label="Período" value={range} options={RANGE_OPTIONS} onChange={setRange} />
      </div>

      <div className={clsx("grid grid-cols-2 gap-3 transition-opacity lg:grid-cols-4", isFetching && stats && "opacity-70")}>
        <StatTile label="Uptime" value={formatUptime(summary?.uptimePercent, 3)} />
        <StatTile label="Latência média" value={formatLatency(summary?.avgLatencyMs)} />
        <StatTile label="Latência p95" value={formatLatency(summary?.p95LatencyMs)} hint="95% dos checks abaixo disso" />
        <StatTile
          label="Checks"
          value={summary ? summary.totalChecks.toLocaleString("pt-BR") : "—"}
          hint={summary ? `${summary.failedChecks.toLocaleString("pt-BR")} com falha` : undefined}
        />
      </div>

      <Card>
        <CardHeader
          title="Latência média (ms)"
          description={stats ? `Agrupada a cada ${formatInterval(stats.bucketMinutes * 60)}` : undefined}
          action={
            <span className="flex items-center gap-1.5 text-xs text-fg-2">
              <span className="size-3 rounded-[2px] bg-bad/30" aria-hidden />
              Período com falhas
            </span>
          }
        />
        <div className="px-2 py-4 sm:px-4">
          {isPending ? (
            <Spinner />
          ) : error ? (
            <ErrorState message={error.message} />
          ) : (
            <LatencyChart series={stats.series} bucketMinutes={stats.bucketMinutes} range={range} />
          )}
        </div>
      </Card>
    </section>
  );
}

function AvailabilitySection({ monitorId }: { monitorId: string }) {
  const { data, isPending, error } = useMonitorDaily(monitorId);
  return (
    <Card>
      <CardHeader title="Disponibilidade — últimos 90 dias" description="Cada barra é um dia (UTC). Passe o mouse para ver os detalhes." action={<UptimeLegend />} />
      <div className="px-5 py-5">
        {isPending ? <Spinner /> : error ? <ErrorState message={error.message} /> : <UptimeBars days={data.days} uptimePercent={data.uptimePercent} />}
      </div>
    </Card>
  );
}

function RecentChecks({ monitorId }: { monitorId: string }) {
  const [onlyFailures, setOnlyFailures] = useState(false);
  const { data, isPending, error } = useChecks(monitorId, onlyFailures ? "DOWN" : undefined);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Checks recentes"
        action={
          <Segmented
            label="Filtrar checks"
            value={onlyFailures ? "down" : "all"}
            options={[
              { value: "all", label: "Todos" },
              { value: "down", label: "Só falhas" },
            ]}
            onChange={(v) => setOnlyFailures(v === "down")}
          />
        }
      />
      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorState message={error.message} />
      ) : data.data.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">{onlyFailures ? "Nenhuma falha registrada. 🎉" : "Nenhum check ainda."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium tracking-wide text-muted uppercase">
                <th className="px-5 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 font-medium">Horário</th>
                <th className="px-3 py-2.5 text-right font-medium">HTTP</th>
                <th className="px-3 py-2.5 text-right font-medium">Latência</th>
                <th className="px-5 py-2.5 font-medium">Detalhe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.data.map((check) => (
                <tr key={check.id}>
                  <td className="px-5 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-fg">
                      <span className={clsx("size-2 rounded-full", check.status === "UP" ? "bg-good" : "bg-bad")} aria-hidden />
                      {check.status === "UP" ? "OK" : "Falha"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-fg-2">{formatDateTime(check.checkedAt)}</td>
                  <td className="px-3 py-2.5 text-right tabular text-fg-2">{check.statusCode ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular text-fg-2">{formatLatency(check.latencyMs)}</td>
                  <td className="max-w-64 truncate px-5 py-2.5 text-muted" title={check.error ?? undefined}>
                    {check.error ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ConfigCard({ monitor }: { monitor: Monitor }) {
  const rows: [string, ReactNode][] = [
    ["Método", monitor.method],
    ["Intervalo", formatInterval(monitor.intervalSeconds)],
    ["Timeout", formatLatency(monitor.timeoutMs)],
    ["Status esperado", `HTTP ${monitor.expectedStatus}`],
    ["Alertar após", `${monitor.failureThreshold} ${monitor.failureThreshold === 1 ? "falha" : "falhas seguidas"}`],
  ];

  return (
    <Card className="h-fit">
      <CardHeader title="Configuração" />
      <dl className="divide-y divide-line text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-5 py-2.5">
            <dt className="text-muted">{label}</dt>
            <dd className="text-right text-fg">{value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 px-5 py-2.5">
          <dt className="flex items-center gap-1.5 text-muted">
            <Bell className="size-3.5" aria-hidden /> Alertas
          </dt>
          <dd className="text-fg">{monitor.webhookProvider ? (monitor.webhookProvider === "DISCORD" ? "Discord" : "Slack") : "Desativados"}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 px-5 py-2.5">
          <dt className="flex items-center gap-1.5 text-muted">
            <Globe className="size-3.5" aria-hidden /> Página pública
          </dt>
          <dd className="text-fg">{monitor.isPublic ? "Visível" : "Oculto"}</dd>
        </div>
      </dl>
    </Card>
  );
}
