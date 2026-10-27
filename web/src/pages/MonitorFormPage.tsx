import { ArrowLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Button, buttonClasses, Card, ErrorState, Field, Input, Select, Spinner } from "../components/ui";
import { ApiError } from "../lib/api";
import { useCreateMonitor, useMonitor, useUpdateMonitor } from "../lib/queries";
import type { HttpMethod, Monitor, MonitorInput, WebhookProvider } from "../lib/types";

const INTERVALS = [
  { value: 30, label: "30 segundos" },
  { value: 60, label: "1 minuto" },
  { value: 300, label: "5 minutos" },
  { value: 600, label: "10 minutos" },
  { value: 1800, label: "30 minutos" },
  { value: 3600, label: "1 hora" },
];

const DEFAULTS: MonitorInput = {
  name: "",
  url: "https://",
  method: "GET",
  intervalSeconds: 60,
  timeoutMs: 10_000,
  expectedStatus: 200,
  failureThreshold: 2,
  isPublic: false,
  webhookUrl: null,
  webhookProvider: null,
};

const toInput = (m: Monitor): MonitorInput => ({
  name: m.name,
  url: m.url,
  method: m.method,
  intervalSeconds: m.intervalSeconds,
  timeoutMs: m.timeoutMs,
  expectedStatus: m.expectedStatus,
  failureThreshold: m.failureThreshold,
  isPublic: m.isPublic,
  webhookUrl: m.webhookUrl,
  webhookProvider: m.webhookProvider,
});

export function NewMonitorPage() {
  return <MonitorForm initial={DEFAULTS} />;
}

export function EditMonitorPage() {
  const { id = "" } = useParams();
  const { data: monitor, isPending, error } = useMonitor(id);
  if (isPending) return <Spinner />;
  if (error) return <ErrorState message={error.message} />;
  return <MonitorForm initial={toInput(monitor)} monitorId={monitor.id} />;
}

function MonitorForm({ initial, monitorId }: { initial: MonitorInput; monitorId?: string }) {
  const navigate = useNavigate();
  const create = useCreateMonitor();
  const update = useUpdateMonitor(monitorId ?? "");
  const mutation = monitorId ? update : create;

  const [form, setForm] = useState<MonitorInput>(initial);
  const set = <K extends keyof MonitorInput>(key: K, value: MonitorInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const apiError = mutation.error instanceof ApiError ? mutation.error : null;
  const fieldError = (path: keyof MonitorInput) => apiError?.fieldError(path);
  const hasFieldErrors = Boolean(apiError?.issues.length);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload: MonitorInput = {
      ...form,
      name: form.name.trim(),
      url: form.url.trim(),
      webhookUrl: form.webhookProvider ? form.webhookUrl?.trim() || null : null,
    };
    mutation.mutate(payload, { onSuccess: (monitor) => navigate(`/monitors/${monitor.id}`) });
  }

  const backTo = monitorId ? `/monitors/${monitorId}` : "/";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <Link to={backTo} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
          <ArrowLeft className="size-4" aria-hidden />
          Voltar
        </Link>
        <h1 className="mt-3 text-[28px] leading-tight font-semibold tracking-tight">{monitorId ? "Editar monitor" : "Novo monitor"}</h1>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
        <Card className="p-5">
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-4 text-sm font-semibold">O que monitorar</legend>
            <Field label="Nome" error={fieldError("name")}>
              {(id, d) => (
                <Input id={id} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="API de pagamentos" aria-describedby={d} aria-invalid={Boolean(fieldError("name"))} autoFocus={!monitorId} />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
              <Field label="Método" error={fieldError("method")}>
                {(id, d) => (
                  <Select id={id} value={form.method} onChange={(e) => set("method", e.target.value as HttpMethod)} aria-describedby={d}>
                    <option value="GET">GET</option>
                    <option value="HEAD">HEAD</option>
                    <option value="POST">POST</option>
                  </Select>
                )}
              </Field>
              <Field label="URL" error={fieldError("url")}>
                {(id, d) => (
                  <Input id={id} type="url" inputMode="url" value={form.url} onChange={(e) => set("url", e.target.value)} placeholder="https://api.exemplo.com/health" aria-describedby={d} aria-invalid={Boolean(fieldError("url"))} />
                )}
              </Field>
            </div>
          </fieldset>
        </Card>

        <Card className="p-5">
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-4 text-sm font-semibold">Como checar</legend>
            <Field label="Intervalo" error={fieldError("intervalSeconds")}>
              {(id, d) => (
                <Select id={id} value={form.intervalSeconds} onChange={(e) => set("intervalSeconds", Number(e.target.value))} aria-describedby={d}>
                  {INTERVALS.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Timeout (ms)" hint="Entre 1.000 e 30.000 ms, menor que o intervalo" error={fieldError("timeoutMs")}>
              {(id, d) => (
                <Input id={id} type="number" min={1000} max={30000} step={500} value={form.timeoutMs} onChange={(e) => set("timeoutMs", Number(e.target.value))} aria-describedby={d} aria-invalid={Boolean(fieldError("timeoutMs"))} />
              )}
            </Field>
            <Field label="Status HTTP esperado" error={fieldError("expectedStatus")}>
              {(id, d) => (
                <Input id={id} type="number" min={100} max={599} value={form.expectedStatus} onChange={(e) => set("expectedStatus", Number(e.target.value))} aria-describedby={d} aria-invalid={Boolean(fieldError("expectedStatus"))} />
              )}
            </Field>
            <Field label="Falhas seguidas para alertar" hint="Evita alertas por oscilações pontuais" error={fieldError("failureThreshold")}>
              {(id, d) => (
                <Input id={id} type="number" min={1} max={10} value={form.failureThreshold} onChange={(e) => set("failureThreshold", Number(e.target.value))} aria-describedby={d} aria-invalid={Boolean(fieldError("failureThreshold"))} />
              )}
            </Field>
          </fieldset>
        </Card>

        <Card className="p-5">
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-4 text-sm font-semibold">Alertas e visibilidade</legend>
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <Field label="Webhook" error={fieldError("webhookProvider")}>
                {(id, d) => (
                  <Select
                    id={id}
                    value={form.webhookProvider ?? ""}
                    onChange={(e) => set("webhookProvider", (e.target.value || null) as WebhookProvider | null)}
                    aria-describedby={d}
                  >
                    <option value="">Sem alertas</option>
                    <option value="DISCORD">Discord</option>
                    <option value="SLACK">Slack</option>
                  </Select>
                )}
              </Field>
              {form.webhookProvider && (
                <Field
                  label="URL do webhook"
                  hint={form.webhookProvider === "DISCORD" ? "Canal → Editar → Integrações → Webhooks" : "Apps → Incoming Webhooks"}
                  error={fieldError("webhookUrl")}
                >
                  {(id, d) => (
                    <Input
                      id={id}
                      type="url"
                      value={form.webhookUrl ?? ""}
                      onChange={(e) => set("webhookUrl", e.target.value)}
                      placeholder={form.webhookProvider === "DISCORD" ? "https://discord.com/api/webhooks/…" : "https://hooks.slack.com/services/…"}
                      aria-describedby={d}
                      aria-invalid={Boolean(fieldError("webhookUrl"))}
                    />
                  )}
                </Field>
              )}
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 hover:bg-surface-2">
              <input type="checkbox" checked={form.isPublic} onChange={(e) => set("isPublic", e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
              <span>
                <span className="block text-sm font-medium">Exibir na página pública de status</span>
                <span className="block text-sm text-muted">Mostra só o nome e a disponibilidade — nunca a URL.</span>
              </span>
            </label>
          </fieldset>
        </Card>

        {apiError && !hasFieldErrors && (
          <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-fg">
            {apiError.message}
          </p>
        )}
        {mutation.error && !apiError && (
          <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-fg">
            {mutation.error.message}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Link to={backTo} className={buttonClasses()}>
            Cancelar
          </Link>
          <Button type="submit" variant="primary" loading={mutation.isPending}>
            {monitorId ? "Salvar alterações" : "Criar monitor"}
          </Button>
        </div>
      </form>
    </div>
  );
}
