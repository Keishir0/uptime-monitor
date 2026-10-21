import { clsx } from "clsx";
import { Activity, ExternalLink, LayoutDashboard, LogOut, Settings } from "lucide-react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../auth/AuthProvider";
import { ThemeToggle } from "../components/ThemeToggle";
import { Spinner } from "../components/ui";

/** `compact`: em telas pequenas mostra só o ícone (o texto vira sr-only). */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight whitespace-nowrap text-fg">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-good text-white">
        <Activity className="size-4" strokeWidth={2.5} aria-hidden />
      </span>
      <span className={compact ? "max-sm:sr-only" : undefined}>Uptime Monitor</span>
    </span>
  );
}

const navItems = [
  { to: "/", label: "Monitores", icon: LayoutDashboard, end: true },
  { to: "/settings", label: "Configurações", icon: Settings, end: false },
];

/** Layout das rotas privadas: redireciona para o login se não houver sessão. */
export function AppLayout() {
  const { user, isLoading, logout } = useAuth();
  const location = useLocation();

  if (isLoading) return <Spinner label="Carregando sessão" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 sm:gap-6 sm:px-6">
          <Link to="/" aria-label="Uptime Monitor — início">
            <Logo compact />
          </Link>

          <nav className="flex items-center gap-1" aria-label="Principal">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition",
                    isActive ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                  )
                }
              >
                <Icon className="size-4" aria-hidden />
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
            {user.statusPageSlug && (
              <a
                href={`/status/${user.statusPageSlug}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition hover:text-fg"
              >
                <ExternalLink className="size-4" aria-hidden />
                <span className="hidden md:inline">Página pública</span>
              </a>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <span className="mr-2 hidden text-sm text-muted lg:inline">{user.email}</span>
            <ThemeToggle />
            <button
              type="button"
              onClick={logout}
              className="rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-fg"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
