import { useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { Logo } from "../layouts/AppLayout";
import { ApiError } from "../lib/api";
import { Button, Field, Input } from "../components/ui";
import { ThemeToggle } from "../components/ThemeToggle";

// Conta criada por `npm run db:seed` no server (ver server/src/scripts/seed-demo.ts).
const DEMO_CREDENTIALS = { email: "demo@example.com", password: "demo12345" };

function AuthShell({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
          <h1 className="text-lg font-semibold">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

function useRedirectAfterAuth() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  return () => navigate(from, { replace: true });
}

export function LoginPage() {
  const { user, login } = useAuth();
  const redirect = useRedirectAfterAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(credentials: { email: string; password: string }) {
    setSubmitting(true);
    setError(null);
    try {
      await login(credentials.email, credentials.password);
      redirect();
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "UNKNOWN", "Erro inesperado"));
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit({ email, password });
  }

  return (
    <AuthShell
      title="Entrar"
      subtitle={
        <>
          Não tem conta?{" "}
          <Link to="/register" className="font-medium text-accent hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="E-mail" error={error?.fieldError("email")}>
          {(id, describedBy) => (
            <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} aria-describedby={describedBy} autoFocus />
          )}
        </Field>
        <Field label="Senha" error={error?.fieldError("password")}>
          {(id, describedBy) => (
            <Input id={id} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} aria-describedby={describedBy} />
          )}
        </Field>
        {error && error.issues.length === 0 && (
          <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-fg">
            {error.message}
          </p>
        )}
        <Button type="submit" variant="primary" loading={submitting} className="mt-2">
          Entrar
        </Button>
        {import.meta.env.DEV && (
          <Button variant="ghost" disabled={submitting} onClick={() => void submit(DEMO_CREDENTIALS)}>
            Entrar com a conta demo
          </Button>
        )}
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const redirect = useRedirectAfterAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await register(form.name, form.email, form.password);
      redirect();
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "UNKNOWN", "Erro inesperado"));
    } finally {
      setSubmitting(false);
    }
  }

  const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

  return (
    <AuthShell
      title="Criar conta"
      subtitle={
        <>
          Já tem conta?{" "}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Nome" error={error?.fieldError("name")}>
          {(id, describedBy) => <Input id={id} autoComplete="name" value={form.name} onChange={set("name")} aria-describedby={describedBy} autoFocus />}
        </Field>
        <Field label="E-mail" error={error?.fieldError("email")}>
          {(id, describedBy) => <Input id={id} type="email" autoComplete="email" value={form.email} onChange={set("email")} aria-describedby={describedBy} />}
        </Field>
        <Field label="Senha" hint="Mínimo de 8 caracteres" error={error?.fieldError("password")}>
          {(id, describedBy) => (
            <Input id={id} type="password" autoComplete="new-password" value={form.password} onChange={set("password")} aria-describedby={describedBy} />
          )}
        </Field>
        {error && error.issues.length === 0 && (
          <p role="alert" className="rounded-lg bg-bad/10 px-3 py-2 text-sm text-fg">
            {error.message}
          </p>
        )}
        <Button type="submit" variant="primary" loading={submitting} className="mt-2">
          Criar conta
        </Button>
      </form>
    </AuthShell>
  );
}
