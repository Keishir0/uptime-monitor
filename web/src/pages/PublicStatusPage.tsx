import { clsx } from "clsx";
import { Activity } from "lucide-react";
import { useEffect } from "react";
import { useParams } from "react-router";
import { OVERALL_STATUS, StatusBadge } from "../components/status";
import { ThemeToggle } from "../components/ThemeToggle";
import { UptimeBars, UptimeLegend } from "../components/UptimeBars";
import { ErrorState, Spinner } from "../components/ui";
import { ApiError } from "../lib/api";
import { formatRelative } from "../lib/format";
import { usePublicStatus } from "../lib/queries";

export function PublicStatusPage() {
  const { slug = "" } = useParams();
  const { data: page, isPending, error } = usePublicStatus(slug);

  useEffect(() => {
    document.title = page ? `Status · ${page.name}` : "Status";
    return () => {
      document.title = "Uptime Monitor";
    };
  }, [page]);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <span className="text-lg font-semibold tracking-tight">{page?.name ?? " "}</span>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {isPending ? (
          <Spinner />
        ) : error ? (
          <ErrorState
            message={error instanceof ApiError && error.status === 404 ? "Página de status não encontrada." : "Não foi possível carregar o status agora."}
          />
        ) : (
          <div className="flex flex-col gap-8">
            <OverallBanner status={page.overallStatus} />

            {page.monitors.length === 0 ? (
              <p className="text-center text-sm text-muted">Nenhum serviço publicado nesta página ainda.</p>
            ) : (
              <section aria-labelledby="services-title">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <h2 id="services-title" className="text-sm font-semibold">
                    Serviços
                  </h2>
                  <UptimeLegend />
                </div>
                <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
                  {page.monitors.map((monitor) => (
                    <li key={monitor.id} className="px-5 py-5">
                      <div className="mb-3 flex items-center justify-between gap-4">
                        <h3 className="truncate font-medium">{monitor.name}</h3>
                        <StatusBadge status={monitor.status} size="sm" />
                      </div>
                      <UptimeBars days={monitor.days} uptimePercent={monitor.uptimePercent} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>Atualizado {formatRelative(page.generatedAt)} · atualiza sozinho a cada minuto</span>
              <span className="flex items-center gap-1.5">
                <Activity className="size-3.5" aria-hidden />
                Uptime Monitor
              </span>
            </footer>
          </div>
        )}
      </main>
    </div>
  );
}

function OverallBanner({ status }: { status: keyof typeof OVERALL_STATUS }) {
  const { title, icon: Icon, tone } = OVERALL_STATUS[status];
  return (
    <div className="flex items-center gap-4 rounded-xl border border-line bg-surface p-5">
      <span className={clsx("flex size-11 shrink-0 items-center justify-center rounded-full text-white", tone)}>
        <Icon className="size-6" aria-hidden />
      </span>
      <div>
        <p className="text-lg font-semibold tracking-tight">{title}</p>
        <p className="text-sm text-muted">
          {status === "OPERATIONAL"
            ? "Nenhum incidente em andamento."
            : status === "UNKNOWN"
              ? "Os serviços ainda não foram verificados."
              : "Estamos cientes do problema e acompanhando."}
        </p>
      </div>
    </div>
  );
}
