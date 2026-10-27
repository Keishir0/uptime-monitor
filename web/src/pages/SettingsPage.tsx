import { Check, Copy, ExternalLink } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthProvider";
import { Button, Card, CardHeader, Field, Input } from "../components/ui";
import { ApiError } from "../lib/api";
import { useMonitors, useUpdateProfile } from "../lib/queries";

export function SettingsPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight">Configurações</h1>
        <p className="mt-1 text-sm text-muted">{user.email}</p>
      </div>
      <ProfileCard initialName={user.name} />
      <StatusPageCard initialSlug={user.statusPageSlug} />
    </div>
  );
}

function ProfileCard({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const update = useUpdateProfile();
  const apiError = update.error instanceof ApiError ? update.error : null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    update.mutate({ name: name.trim() });
  }

  return (
    <Card>
      <CardHeader title="Perfil" description="O nome aparece no topo da sua página pública de status." />
      <form onSubmit={onSubmit} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="Nome" error={apiError?.fieldError("name") ?? (apiError && !apiError.issues.length ? apiError.message : undefined)}>
            {(id, d) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} aria-describedby={d} />}
          </Field>
        </div>
        <Button type="submit" loading={update.isPending} disabled={name.trim() === initialName}>
          {update.isSuccess && name.trim() === initialName ? "Salvo" : "Salvar"}
        </Button>
      </form>
    </Card>
  );
}

function StatusPageCard({ initialSlug }: { initialSlug: string | null }) {
  const [slug, setSlug] = useState(initialSlug ?? "");
  const [copied, setCopied] = useState(false);
  const update = useUpdateProfile();
  const { data: monitors } = useMonitors();
  const apiError = update.error instanceof ApiError ? update.error : null;

  const publicCount = monitors?.filter((m) => m.isPublic).length ?? 0;
  const publicUrl = initialSlug ? `${window.location.origin}/status/${initialSlug}` : null;
  const normalized = slug.trim().toLowerCase();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    update.mutate({ statusPageSlug: normalized || null });
  }

  async function copy() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader
        title="Página pública de status"
        description={`Uma página sem login, estilo Statuspage, para seus usuários acompanharem a disponibilidade. ${publicCount} ${publicCount === 1 ? "monitor visível" : "monitores visíveis"}.`}
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-4 p-5">
        <Field
          label="Endereço"
          hint="Letras minúsculas, números e hífens. Deixe vazio para desativar a página."
          error={apiError?.fieldError("statusPageSlug") ?? (apiError && !apiError.issues.length ? apiError.message : undefined)}
        >
          {(id, d) => (
            <div className="flex items-stretch overflow-hidden rounded-lg border border-line focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
              <span className="flex items-center border-r border-line bg-surface-2 px-3 text-sm whitespace-nowrap text-muted">/status/</span>
              <input
                id={id}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="minha-empresa"
                aria-describedby={d}
                className="h-10 min-w-0 flex-1 bg-surface px-3 text-sm text-fg placeholder:text-muted focus:outline-none"
              />
            </div>
          )}
        </Field>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {publicUrl ? (
            <div className="flex min-w-0 items-center gap-1">
              <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1.5 text-sm text-accent hover:underline">
                <span className="truncate">{publicUrl}</span>
                <ExternalLink className="size-3.5 shrink-0" aria-hidden />
              </a>
              <button type="button" onClick={() => void copy()} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-fg" aria-label="Copiar link">
                {copied ? <Check className="size-4 text-good" /> : <Copy className="size-4" />}
              </button>
            </div>
          ) : (
            <span className="text-sm text-muted">Página desativada</span>
          )}
          <Button type="submit" loading={update.isPending} disabled={normalized === (initialSlug ?? "")}>
            Salvar endereço
          </Button>
        </div>

        {publicCount === 0 && initialSlug && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-fg-2">
            Nenhum monitor está visível ainda. Edite um monitor e marque “Exibir na página pública de status”.
          </p>
        )}
      </form>
    </Card>
  );
}
